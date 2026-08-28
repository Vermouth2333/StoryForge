import { NextResponse } from "next/server";
import { z } from "zod";
import { logBasicSafe } from "@/lib/basic-logs";
import { getCurrentUserId } from "@/lib/auth";
import { scanTextBundle } from "@/lib/content-filter";
import { CREDIT_COSTS, InsufficientCreditsError, refundCredits, spendCredits } from "@/lib/credits";
import { getDb, id, nowIso } from "@/lib/db";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";
import type { ChatMessage } from "@/lib/ai-provider";
import { produceChatText, resolveSessionProviderChain } from "@/lib/chat-produce-text";
import { adjustAffinity, estimateAffinityDelta, getAffinity } from "@/lib/affinity";
import { buildChatContext } from "@/lib/prompt-context";
import { conflictDetector } from "@/lib/conflict-detector";

const schema = z.object({
  content: z.string().min(1).max(5000),
});

const HEARTBEAT_MS = 15_000;

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
    persona_mask_id: string | null;
  }>(
    "SELECT id, session_type, story_id, character_id, world_id, persona_mask_id FROM chat_sessions WHERE id = ? AND user_id = ?",
    sessionId,
    userId,
  );
  if (!session) {
    return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
  }

  let affinityInfo: { score: number; label: string } | null = null;
  if (session.character_id) {
    const aff = await getAffinity(db, userId, session.character_id, session.story_id);
    affinityInfo = { score: aff.score, label: aff.label };
  }

  // 在写入本轮用户消息之前组装上下文（系统/世界/角色/文风/历史 + 当前指令）
  const providerChain = await resolveSessionProviderChain(sessionId, userId);
  if (providerChain.length === 0) {
    return NextResponse.json({ code: 503, msg: "创作服务暂不可用" }, { status: 503 });
  }
  let contextMessages: ChatMessage[] = [];
  try {
    contextMessages = await buildChatContext(db, sessionId, session, parsed.data.content);
    if (affinityInfo && session.character_id) {
      contextMessages.splice(1, 0, {
        role: "system",
        content: `# 当前好感度\n与该角色的好感度为 ${affinityInfo.score}/100（${affinityInfo.label}）。请据此调整语气与亲密度，不要突然越级亲密或冷漠。`,
      });
    }
  } catch {
    contextMessages = [{ role: "user", content: parsed.data.content }];
  }

  const userMessageId = id("msg");
  const now = nowIso();
  try {
    await spendCredits({
      userId,
      reason: "chat",
      refType: "chat_message",
      refId: userMessageId,
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { code: 402, msg: `${err.message}，请前往积分页充值`, data: { need: err.need, balance: err.balance } },
        { status: 402 },
      );
    }
    throw err;
  }
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

        const emit = (part: string) => {
          fullText += part;
          controller.enqueue(sseData({ type: "content", content: part, seq }));
          seq += 1;
        };

        const { usedModelName, stopped, timedOut } = await produceChatText({
          sessionId,
          userId,
          contextMessages,
          providerChain,
          streamStarted,
          emit,
          logCategory: "chat_generate",
        });

        if (usedModelName === "mock-model") {
          await refundCredits({
            userId,
            reason: "refund_chat",
            amount: CREDIT_COSTS.chat,
            refType: "chat_message",
            refId: userMessageId,
            note: "模型不可用已退回",
          });
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

        // 角色/故事 NPC 好感记账
        let affinityPayload: { score: number; label: string; key: string } | null = null;
        if (session.character_id && fullText.trim().length > 0) {
          try {
            const delta = estimateAffinityDelta(parsed.data.content);
            const next = await adjustAffinity(
              db,
              userId,
              session.character_id,
              session.story_id,
              delta,
            );
            affinityPayload = { score: next.score, label: next.label, key: next.key };
          } catch {
            // 好感更新失败不影响主流程
          }
        }

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
          sseData({
            type: "done",
            message_id: assistantMessageId,
            seq,
            affinity: affinityPayload,
          }),
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
