import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** PATCH — 更新检查点备注 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; snapshotId: string }> },
) {
  const { id: sessionId, snapshotId } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const db = await getDb();
  const snap = await db.get<{ id: string }>(
    "SELECT id FROM snapshots WHERE id = ? AND session_id = ? AND user_id = ?",
    snapshotId,
    sessionId,
    userId,
  );
  if (!snap) {
    return NextResponse.json({ code: 404, msg: "检查点不存在" }, { status: 404 });
  }

  let label = "";
  try {
    const body = await request.json();
    label = typeof body?.label === "string" ? body.label.trim().slice(0, 120) : "";
  } catch {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  await db.run("UPDATE snapshots SET label = ? WHERE id = ?", label, snapshotId);
  return NextResponse.json({ code: 200, msg: "已更新备注", data: { id: snapshotId, label } });
}

/** DELETE — 删除检查点 */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string; snapshotId: string }> },
) {
  const { id: sessionId, snapshotId } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const db = await getDb();
  const snap = await db.get<{ id: string }>(
    "SELECT id FROM snapshots WHERE id = ? AND session_id = ? AND user_id = ?",
    snapshotId,
    sessionId,
    userId,
  );
  if (!snap) {
    return NextResponse.json({ code: 404, msg: "检查点不存在" }, { status: 404 });
  }

  await db.run("DELETE FROM snapshots WHERE id = ?", snapshotId);
  return NextResponse.json({ code: 200, msg: "已删除检查点" });
}
