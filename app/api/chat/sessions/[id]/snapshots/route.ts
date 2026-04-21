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

  const snapshots = rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    label: r.label,
    payload: JSON.parse(r.payload_json || "{}"),
    created_at: r.created_at,
  }));

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

  const payload = {
    last_message_id: last.id,
    last_message_at: last.created_at,
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
