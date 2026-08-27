import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

type SnapshotRow = {
  id: string;
  session_id: string;
  user_id: string;
  label: string;
  payload_json: string;
  created_at: string;
};

type SnapshotPayload = {
  last_message_id?: string;
  last_message_at?: string;
  last_assistant_id?: string;
  last_assistant_preview?: string;
};

type MessageLite = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

function clipPreview(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function parsePayload(raw: string): SnapshotPayload {
  try {
    return JSON.parse(raw || "{}") as SnapshotPayload;
  } catch {
    return {};
  }
}

/** GET — 会话快照列表 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await ctx.params;
  const userId = await getCurrentUserId();

  const db = await getDb();
  const owns = await db.get<{ c: number }>(
    "SELECT COUNT(1) as c FROM chat_sessions WHERE id = ? AND user_id = ?",
    sessionId,
    userId,
  );
  if (!owns || owns.c === 0) {
    return NextResponse.json({ code: 403, msg: "会话不存在或无权限" }, { status: 403 });
  }

  const rows = await db.all<SnapshotRow[]>(
    `SELECT id, session_id, user_id, label, payload_json, created_at
     FROM snapshots WHERE session_id = ? ORDER BY datetime(created_at) DESC`,
    sessionId,
  );

  const parsed = rows.map((r) => ({ row: r, payload: parsePayload(r.payload_json) }));
  const linkedIds = [
    ...new Set(
      parsed.flatMap((p) => [p.payload.last_assistant_id, p.payload.last_message_id].filter(Boolean) as string[]),
    ),
  ];
  const linkedMsgs =
    linkedIds.length > 0
      ? await db.all<MessageLite[]>(
          `SELECT id, role, content, created_at FROM chat_messages WHERE id IN (${linkedIds.map(() => "?").join(",")})`,
          ...linkedIds,
        )
      : [];
  const msgById = new Map(linkedMsgs.map((m) => [m.id, m]));

  const snapshots = await Promise.all(
    parsed.map(async ({ row, payload }) => {
      let assistantId = payload.last_assistant_id || "";
      let preview = payload.last_assistant_preview || "";
      const linked = msgById.get(payload.last_assistant_id || "") ?? msgById.get(payload.last_message_id || "");
      if (linked?.role === "assistant") {
        assistantId = linked.id;
        preview = preview || clipPreview(linked.content);
      } else if (linked && !preview) {
        const prevAsst = await db.get<MessageLite>(
          `SELECT id, role, content, created_at FROM chat_messages
           WHERE session_id = ? AND role = 'assistant' AND datetime(created_at) <= datetime(?)
           ORDER BY datetime(created_at) DESC, id DESC LIMIT 1`,
          sessionId,
          linked.created_at,
        );
        if (prevAsst) {
          assistantId = prevAsst.id;
          preview = clipPreview(prevAsst.content);
        }
      }
      return {
        id: row.id,
        session_id: row.session_id,
        label: row.label,
        payload: {
          ...payload,
          last_assistant_id: assistantId || payload.last_message_id,
          last_assistant_preview: preview,
        },
        created_at: row.created_at,
      };
    }),
  );

  return NextResponse.json({ code: 200, data: { snapshots }, msg: "ok" });
}

/** POST — 基于当前最后一条消息创建快照 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await ctx.params;
  const userId = await getCurrentUserId();

  const db = await getDb();
  const owns = await db.get<{ c: number }>(
    "SELECT COUNT(1) as c FROM chat_sessions WHERE id = ? AND user_id = ?",
    sessionId,
    userId,
  );
  if (!owns || owns.c === 0) {
    return NextResponse.json({ code: 403, msg: "会话不存在或无权限" }, { status: 403 });
  }

  let label = "";
  try {
    const body = await request.json();
    label = typeof body?.label === "string" ? body.label.slice(0, 120) : "";
  } catch {
    /* optional body */
  }

  const last = await db.get<{ id: string; created_at: string }>(
    `SELECT id, created_at FROM chat_messages
     WHERE session_id = ?
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 1`,
    sessionId,
  );

  if (!last) {
    return NextResponse.json({ code: 400, msg: "暂无消息，无法创建快照" }, { status: 400 });
  }

  const lastAssistant = await db.get<{ id: string; content: string }>(
    `SELECT id, content FROM chat_messages
     WHERE session_id = ? AND role = 'assistant'
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT 1`,
    sessionId,
  );

  const payload = {
    last_message_id: last.id,
    last_message_at: last.created_at,
    last_assistant_id: lastAssistant?.id ?? last.id,
    last_assistant_preview: lastAssistant ? clipPreview(lastAssistant.content) : "",
  };

  const sid = id("snap");
  const created = nowIso();
  await db.run(
    `INSERT INTO snapshots (id, session_id, user_id, label, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    sid,
    sessionId,
    userId,
    label,
    JSON.stringify(payload),
    created,
  );

  return NextResponse.json({
    code: 200,
    data: {
      snapshot: {
        id: sid,
        session_id: sessionId,
        label,
        payload,
        created_at: created,
      },
    },
    msg: "ok",
  });
}
