import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { deleteChatSession } from "@/lib/delete-content";
import { getDb } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const db = await getDb();
  const row = await db.get<{
    id: string;
    session_type: string;
    story_id: string | null;
    character_id: string | null;
    world_id: string | null;
    title: string | null;
    last_message_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, session_type, story_id, character_id, world_id, title, last_message_at, created_at, updated_at
     FROM chat_sessions
     WHERE id = ? AND user_id = ?`,
    id,
    userId,
  );

  if (!row) {
    return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
  }

  return NextResponse.json({ code: 200, data: row, msg: "ok" });
}

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
