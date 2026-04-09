import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { consumeStop } from "@/lib/chat-state";
import { getDb, id, nowIso } from "@/lib/db";

const schema = z.object({
  content: z.string().min(1).max(5000),
});

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

  const userId = await getCurrentUserId();
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
      const chunks = [
        "已收到你的创作指令，",
        "这是一个 MVP 版本的流式回复。",
        "你可以继续扩展为真实模型输出。",
      ];

      let fullText = "";
      let seq = 1;
      for (const part of chunks) {
        if (consumeStop(sessionId)) {
          controller.enqueue(
            sseData({ type: "done", reason: "stopped", seq, incomplete: true }),
          );
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
      controller.close();
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
