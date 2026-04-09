import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const db = await getDb();

  const session = await db.get<{ id: string }>(
    "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
    id,
    userId,
  );

  if (!session) {
    return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
  }

  const rows = await db.all(
    `SELECT id, role, content, token_input, token_output, latency_ms, model_name, created_at
     FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
    id,
  );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}
