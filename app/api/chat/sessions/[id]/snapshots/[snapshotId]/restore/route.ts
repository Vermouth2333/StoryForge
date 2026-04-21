import { NextResponse } from "next/server";
import { logBasicSafe } from "@/lib/basic-logs";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** POST — 恢复快照：删除快照边界之后的所有消息 */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string; snapshotId: string }> },
) {
  const { id: sessionId, snapshotId } = await ctx.params;
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

  const snap = await db.get<{ payload_json: string }>(
    "SELECT payload_json FROM snapshots WHERE id = ? AND session_id = ? AND user_id = ?",
    snapshotId,
    sessionId,
    userId,
  );
  if (!snap) {
    return NextResponse.json({ code: 404, msg: "快照不存在" }, { status: 404 });
  }

  let payload: { last_message_id?: string; last_message_at?: string };
  try {
    payload = JSON.parse(snap.payload_json || "{}");
  } catch {
    return NextResponse.json({ code: 500, msg: "快照数据损坏" }, { status: 500 });
  }

  const lastId = payload.last_message_id;
  const lastAt = payload.last_message_at;
  if (!lastId || !lastAt) {
    return NextResponse.json({ code: 400, msg: "快照缺少边界信息" }, { status: 400 });
  }

  const msg = await db.get<{ id: string; session_id: string }>(
    "SELECT id, session_id FROM chat_messages WHERE id = ? AND session_id = ?",
    lastId,
    sessionId,
  );
  if (!msg) {
    return NextResponse.json(
      { code: 409, msg: "边界消息已不存在，无法恢复（可能已被清空）" },
      { status: 409 },
    );
  }

  const result = await db.run(
    `DELETE FROM chat_messages
     WHERE session_id = ?
       AND (
         datetime(created_at) > datetime(?)
         OR (datetime(created_at) = datetime(?) AND id > ?)
       )`,
    sessionId,
    lastAt,
    lastAt,
    lastId,
  );

  await logBasicSafe("info", "snapshot restored", {
    category: "snapshot",
    meta: { sessionId, snapshotId, deleted: result.changes },
    user_id: userId,
  });

  return NextResponse.json({
    code: 200,
    data: { deleted_messages: result.changes ?? 0 },
    msg: "ok",
  });
}
