import { NextResponse } from "next/server";
import { logBasicSafe } from "@/lib/basic-logs";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";
import type { ChatMessage } from "@/lib/ai-provider";
import { produceChatText, resolveSessionProviderChain } from "@/lib/chat-produce-text";
import { getAffinity } from "@/lib/affinity";
import { buildChatContext } from "@/lib/prompt-context";
import { conflictDetector } from "@/lib/conflict-detector";

const HEARTBEAT_MS = 15_000;

const REGENERATE_USER_TURN =
  "请重新生成对用户上一句的回复：保持人设、设定与当前剧情方向，但更换措辞、细节与展开，不要复述上一版。只输出正文。";
const REGENERATE_GREETING =
  "请根据当前设定重新写一段开场白：保持人设与世界观，但更换措辞与细节，不要复述上一版。只输出开场正文。";

function sseData(payload: object) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;

  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const rlUser = rateLimitAllow(`chat_regen:${userId}`, 30, 60_000);
  if (!rlUser.ok) {
    return NextResponse.json(
      {
        code: 429,
        msg: `重新生成过于频繁，请约 ${Math.ceil(rlUser.retryAfterMs / 1000)} 秒后再试`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rlUser.retryAfterMs / 1000)) },
      },
    );
  }
  const rlIp = rateLimitAllow(`chat_regen_ip:${getRequestIp(req)}`, 80, 60_000);
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

  const lastRows = await db.all<{ id: string; role: string; content: string }[]>(
    `SELECT id, role, content FROM chat_messages
     WHERE session_id = ? AND role IN ('user','assistant')
     ORDER BY datetime(created_at) DESC, rowid DESC
     LIMIT 2`,
    sessionId,
  );
  const last = lastRows[0];
  if (!last || last.role !== "assistant") {
    return NextResponse.json(
      { code: 400, msg: "当前没有可重新生成的回复" },
      { status: 400 },
    );
  }
  const precedingUser = lastRows[1]?.role === "user" ? lastRows[1] : undefined;

  let affinityInfo: { score: number; label: string } | null = null;
  if (session.character_id) {
    const aff = await getAffinity(db, userId, session.character_id, session.story_id);
    affinityInfo = { score: aff.score, label: aff.label };
  }

  const providerChain = await resolveSessionProviderChain(sessionId, userId);
  const ragQuery = precedingUser?.content ?? REGENERATE_GREETING;
  let contextMessages: ChatMessage[] = [];
  try {
    contextMessages = await buildChatContext(db, sessionId, session, ragQuery, {
      omitMessageId: last.id,
      skipAppendingUser: true,
    });
    if (affinityInfo && session.character_id) {
      contextMessages.splice(1, 0, {
        role: "system",
        content: `# 当前好感度\n与该角色的好感度为 ${affinityInfo.score}/100（${affinityInfo.label}）。请据此调整语气与亲密度，不要突然越级亲密或冷漠。`,
      });
    }
    contextMessages.push({
      role: "user",
      content: precedingUser ? REGENERATE_USER_TURN : REGENERATE_GREETING,
    });
  } catch {
    contextMessages = [{ role: "user", content: ragQuery }];
  }

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
          logCategory: "chat_regenerate",
        });

        if (stopped) {
          // 取消重新生成时保留原文，不落库
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

        await db.run(
          `UPDATE chat_messages
           SET content = ?, token_input = ?, token_output = ?, latency_ms = ?, model_name = ?
           WHERE id = ? AND session_id = ?`,
          fullText,
          Math.ceil(ragQuery.length / 4),
          Math.ceil(fullText.length / 4),
          Date.now() - streamStarted,
          usedModelName,
          last.id,
          sessionId,
        );

        await db.run(
          "UPDATE chat_sessions SET last_message_at = ?, updated_at = ? WHERE id = ?",
          nowIso(),
          nowIso(),
          sessionId,
        );

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
              category: "chat_regenerate",
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
            message_id: last.id,
            seq,
          }),
        );
        closed = true;
        stopHeartbeat();
        controller.close();
      } catch (err) {
        await logBasicSafe("error", "regenerate stream failed", {
          category: "chat_regenerate",
          meta: {
            sessionId,
            message: err instanceof Error ? err.message : String(err),
          },
          user_id: userId,
        });
        controller.enqueue(
          sseData({
            type: "error",
            msg: err instanceof Error ? err.message : "重新生成失败",
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
