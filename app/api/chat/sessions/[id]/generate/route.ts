import { NextResponse } from "next/server";
import { z } from "zod";
import { logBasicSafe } from "@/lib/basic-logs";
import { getCurrentUserId } from "@/lib/auth";
import { consumeStop } from "@/lib/chat-state";
import { scanTextBundle } from "@/lib/content-filter";
import { getDb, id, nowIso } from "@/lib/db";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";
import { ModelManager, type ModelConfig } from "@/lib/model-manager";
import { resolveProvider, streamChat, type ChatMessage, type ResolvedProvider } from "@/lib/ai-provider";
import { buildChatContext } from "@/lib/prompt-context";
import { conflictDetector } from "@/lib/conflict-detector";

const schema = z.object({
  content: z.string().min(1).max(5000),
});

const HEARTBEAT_MS = 15_000;
/** 整体生成时长上限（文档建议长连接不宜无限挂起） */
const MAX_STREAM_MS = 180_000;

/** 未配置真实模型时的占位流式输出片段 */
const MOCK_CHUNKS = [
  "已收到你的创作指令，",
  "这是一个 MVP 版本的流式回复（未配置真实模型）。",
  "请在「设置 → 模型管理」页面配置 API Key 和模型，即可启用真实模型输出。",
];

function sseData(payload: object) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const promptScan = scanTextBundle([parsed.data.content], 50_000);
  if (!promptScan.ok) {
    return NextResponse.json({ code: 400, msg: promptScan.msg }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const rlUser = rateLimitAllow(`chat_gen:${userId}`, 45, 60_000);
  if (!rlUser.ok) {
    return NextResponse.json(
      {
        code: 429,
        msg: `生成请求过于频繁，请约 ${Math.ceil(rlUser.retryAfterMs / 1000)} 秒后再试`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rlUser.retryAfterMs / 1000)) },
      },
    );
  }
  const rlIp = rateLimitAllow(`chat_gen_ip:${getRequestIp(req)}`, 120, 60_000);
  if (!rlIp.ok) {
    return NextResponse.json(
      {
        code: 429,
        msg: `当前网络请求过于频繁，请约 ${Math.ceil(rlIp.retryAfterMs / 1000)} 秒后再试`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rlIp.retryAfterMs / 1000)) },
      },
    );
  }

  const db = await getDb();
  const session = await db.get<{
    id: string;
    session_type: string;
    story_id: string | null;
    character_id: string | null;
    world_id: string | null;
  }>(
    "SELECT id, session_type, story_id, character_id, world_id FROM chat_sessions WHERE id = ? AND user_id = ?",
    sessionId,
    userId,
  );
  if (!session) {
    return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
  }

  // 在写入本轮用户消息之前组装上下文（系统/世界/角色/文风/历史 + 当前指令）
  // 构建多模型降级链：主模型在前，已启用且已配置凭据的备用模型在后（见文档 5.8.5）
  const primaryModelId = await ModelManager.getSessionModel(sessionId, userId);
  const fallbackIds = await ModelManager.getFallbackModelIds(primaryModelId, userId);
  const providerChain = (await Promise.all(
    fallbackIds.map(async (mid) => {
      const config = await ModelManager.getModelConfig(mid, userId);
      if (!config) return null;
      const provider = resolveProvider(config);
      return provider ? { config, provider } : null;
    }),
  )).filter((x): x is { config: ModelConfig; provider: ResolvedProvider } => x !== null);
  let contextMessages: ChatMessage[] = [];
  try {
    contextMessages = await buildChatContext(db, sessionId, session, parsed.data.content);
  } catch {
    contextMessages = [{ role: "user", content: parsed.data.content }];
  }

  const userMessageId = id("msg");
  const now = nowIso();
  await db.run(
    `INSERT INTO chat_messages (id, session_id, role, content, created_at)
     VALUES (?, ?, 'user', ?, ?)`,
    userMessageId,
    sessionId,
    parsed.data.content,
    now,
  );

  const stream = new ReadableStream({
    async start(controller) {
      let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
      let closed = false;

      const stopHeartbeat = () => {
        if (heartbeatTimer !== undefined) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = undefined;
        }
      };

      try {
        const streamStarted = Date.now();

        heartbeatTimer = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(
              sseData({ type: "heartbeat", ts: Math.floor(Date.now() / 1000) }),
            );
          } catch {
            stopHeartbeat();
          }
        }, HEARTBEAT_MS);

        let fullText = "";
        let seq = 1;
        let stopped = false;
        let timedOut = false;
        let usedModelName = "mock-model";

        const emit = (part: string) => {
          fullText += part;
          controller.enqueue(sseData({ type: "content", content: part, seq }));
          seq += 1;
        };

        if (providerChain.length > 0) {
          // 真实模型：按降级链依次尝试，主模型失败且尚无输出时自动切换备用模型
          let producedOutput = false;
          for (let i = 0; i < providerChain.length; i++) {
            if (stopped || timedOut || producedOutput) break;
            const { config, provider } = providerChain[i];
            usedModelName = config.modelName;
            const abort = new AbortController();
            const stopPoll = setInterval(() => {
              if (consumeStop(sessionId)) {
                stopped = true;
                abort.abort();
              }
              if (Date.now() - streamStarted > MAX_STREAM_MS) {
                timedOut = true;
                abort.abort();
              }
            }, 500);
            try {
              for await (const delta of streamChat(provider, contextMessages, {
                temperature: config.defaultTemperature,
                maxTokens: config.maxTokens,
                signal: abort.signal,
              })) {
                emit(delta);
                producedOutput = true;
              }
            } catch (streamErr) {
              if (stopped || timedOut) break;
              await logBasicSafe("warn", "live model failed, trying fallback", {
                category: "chat_generate",
                meta: {
                  sessionId,
                  modelId: config.id,
                  isLast: i === providerChain.length - 1,
                  message:
                    streamErr instanceof Error ? streamErr.message : String(streamErr),
                },
                user_id: userId,
              });
              // 已产生部分输出时无法干净切换模型，停止；否则继续尝试下一个模型
              if (fullText.length > 0) {
                producedOutput = true;
                break;
              }
            } finally {
              clearInterval(stopPoll);
            }
          }

          // 全部真实模型均失败且无任何输出时回退到占位输出，保证可用
          if (!stopped && !timedOut && fullText.length === 0) {
            await logBasicSafe("error", "all live models failed, fallback to mock", {
              category: "chat_generate",
              meta: { sessionId },
              user_id: userId,
            });
            usedModelName = "mock-model";
            for (const part of [
              "已配置的模型调用失败（请检查 API Key、额度与 Base URL）。",
              "DeepSeek 请确认 Base URL 为 https://api.deepseek.com/v1 。",
              "也可到「设置 → AI 模型管理」核对后重试。",
            ]) {
              emit(part);
            }
          }
        } else {
          // 未配置真实模型：保留 MVP 占位流式输出
          for (const part of MOCK_CHUNKS) {
            if (Date.now() - streamStarted > MAX_STREAM_MS) {
              timedOut = true;
              break;
            }
            if (consumeStop(sessionId)) {
              stopped = true;
              break;
            }
            emit(part);
            await new Promise((resolve) => setTimeout(resolve, 280));
          }
        }

        if (stopped) {
          controller.enqueue(
            sseData({ type: "done", reason: "stopped", seq, incomplete: true }),
          );
          closed = true;
          stopHeartbeat();
          controller.close();
          return;
        }
        if (timedOut) {
          controller.enqueue(sseData({ type: "done", reason: "timeout", seq }));
          closed = true;
          stopHeartbeat();
          controller.close();
          return;
        }

        const assistantMessageId = id("msg");
        await db.run(
          `INSERT INTO chat_messages
        (id, session_id, role, content, token_input, token_output, latency_ms, model_name, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?)`,
          assistantMessageId,
          sessionId,
          fullText,
          Math.ceil(parsed.data.content.length / 4),
          Math.ceil(fullText.length / 4),
          Date.now() - streamStarted,
          usedModelName,
          nowIso(),
        );

        await db.run(
          "UPDATE chat_sessions SET last_message_at = ?, updated_at = ? WHERE id = ?",
          nowIso(),
          nowIso(),
          sessionId,
        );

        // 生成主循环集成：对生成内容自动触发冲突检测（P0/P1 拦截提示）
        // 非阻塞——失败不影响本轮生成结果，仅在流中追加一个 conflict 事件
        if (fullText.trim().length > 0) {
          try {
            const characterIds = session.character_id ? [session.character_id] : [];
            const conflicts = await conflictDetector.detect(
              fullText,
              session.world_id,
              characterIds,
            );
            if (conflicts.length > 0) {
              const blocking = conflicts.some(
                (c) => c.level === "P0" || c.level === "P1",
              );
              controller.enqueue(
                sseData({
                  type: "conflict",
                  blocking,
                  conflicts: conflicts.map((c) => ({
                    level: c.level,
                    conflictPoint: c.conflictPoint,
                    reason: c.reason,
                    rewriteSuggestions: c.rewriteSuggestions,
                  })),
                }),
              );
            }
          } catch (conflictErr) {
            await logBasicSafe("warn", "conflict detection failed", {
              category: "chat_generate",
              meta: {
                sessionId,
                message:
                  conflictErr instanceof Error
                    ? conflictErr.message
                    : String(conflictErr),
              },
              user_id: userId,
            });
          }
        }

        controller.enqueue(
          sseData({ type: "done", message_id: assistantMessageId, seq }),
        );
        closed = true;
        stopHeartbeat();
        controller.close();
      } catch (err) {
        await logBasicSafe("error", "generate stream failed", {
          category: "chat_generate",
          meta: {
            sessionId,
            message: err instanceof Error ? err.message : String(err),
          },
          user_id: userId,
        });
        controller.enqueue(
          sseData({
            type: "error",
            msg: err instanceof Error ? err.message : "生成失败",
          }),
        );
        closed = true;
        stopHeartbeat();
        controller.close();
      } finally {
        closed = true;
        stopHeartbeat();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
