import { getDb, id, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const { sessionId } = params_data;
  
  const db = await getDb();
  
  // 验证会话存在且属于该用户
  const session = await db.get(
    "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
    [sessionId, userId]
  );
  
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  
  const body = await request.json();
  const { name, message_id } = body;
  
  // 获取最新的消息
  const lastMessage = await db.get(
    `SELECT * FROM chat_messages 
     WHERE session_id = ? 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [sessionId]
  );
  
  const targetMessageId = message_id || lastMessage?.id;
  
  if (!targetMessageId) {
    return NextResponse.json({ error: "没有可存档的消息" }, { status: 400 });
  }
  
  // 获取从开始到目标消息的所有消息
  const messages = await db.all(
    `SELECT * FROM chat_messages 
     WHERE session_id = ? AND created_at <= (
       SELECT created_at FROM chat_messages WHERE id = ?
     )
     ORDER BY created_at ASC`,
    [sessionId, targetMessageId]
  );
  
  // 创建存档
  const archiveId = id("archive");
  const now = nowIso();
  
  await db.run(
    `INSERT INTO session_archives (id, session_id, user_id, name, message_id, content_snapshot_json, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [archiveId, sessionId, userId, name || `存档 ${new Date().toLocaleDateString()}`, targetMessageId, JSON.stringify(messages), now]
  );
  
  return NextResponse.json({
    code: 200,
    data: {
      id: archiveId,
      session_id: sessionId,
      name: name || `存档 ${new Date().toLocaleDateString()}`,
      message_count: messages.length,
      created_at: now,
    },
    msg: "存档创建成功"
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const { sessionId } = params_data;
  
  const db = await getDb();
  
  // 获取该会话的所有存档
  const archives = await db.all(
    `SELECT * FROM session_archives 
     WHERE session_id = ? AND user_id = ?
     ORDER BY created_at DESC`,
    [sessionId, userId]
  );
  
  return NextResponse.json({
    code: 200,
    data: archives.map(archive => ({
      ...archive,
      message_count: JSON.parse(archive.content_snapshot_json || "[]").length,
    })),
  });
}
