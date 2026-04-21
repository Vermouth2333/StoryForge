import { NextResponse } from "next/server";
import { z } from "zod";
import { logBasicSafe } from "@/lib/basic-logs";
import { getCurrentUserId } from "@/lib/auth";
import { consumeStop } from "@/lib/chat-state";
import { scanTextBundle } from "@/lib/content-filter";
import { getDb, id, nowIso } from "@/lib/db";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";

const schema = z.object({
  content: z.string().min(1).max(5000),
});

const HEARTBEAT_MS = 15_000;
/** 整体生成时长上限（文档建议长连接不宜无限挂起） */
const MAX_STREAM_MS = 180_000;

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
  const session = await db.get<{ id: string }>(
    "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
    sessionId,
    userId,
  );
  if (!session) {
    return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
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

        const chunks = [
          "已收到你的创作指令，",
          "这是一个 MVP 版本的流式回复。",
          "你可以继续扩展为真实模型输出。",
        ];

        let fullText = "";
        let seq = 1;
        for (const part of chunks) {
          if (Date.now() - streamStarted > MAX_STREAM_MS) {
            controller.enqueue(sseData({ type: "done", reason: "timeout", seq }));
            closed = true;
            stopHeartbeat();
            controller.close();
            return;
          }
          if (consumeStop(sessionId)) {
            controller.enqueue(
              sseData({ type: "done", reason: "stopped", seq, incomplete: true }),
            );
            closed = true;
            stopHeartbeat();
            controller.close();
            return;
          }
          fullText += part;
          controller.enqueue(sseData({ type: "content", content: part, seq }));
          seq += 1;
          await new Promise((resolve) => setTimeout(resolve, 280));
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
          800,
          "mock-model",
          nowIso(),
        );

        await db.run(
          "UPDATE chat_sessions SET last_message_at = ?, updated_at = ? WHERE id = ?",
          nowIso(),
          nowIso(),
          sessionId,
        );

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
