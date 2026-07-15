import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { deleteChatSession } from "@/lib/delete-content";
import { getDb } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const db = await getDb();
  const result = await deleteChatSession(db, id, userId);
  if (!result.ok) {
    return NextResponse.json({ code: 404, msg: result.msg }, { status: 404 });
  }

  return NextResponse.json({ code: 200, msg: "会话已删除" });
}
