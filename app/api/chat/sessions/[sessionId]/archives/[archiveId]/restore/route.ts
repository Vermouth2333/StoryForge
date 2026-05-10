import { getDb, id, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string; archiveId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const { sessionId, archiveId } = params_data;
  
  const db = await getDb();
  
  // 验证存档存在且属于该用户
  const archive = await db.get(
    "SELECT * FROM session_archives WHERE id = ? AND session_id = ? AND user_id = ?",
    [archiveId, sessionId, userId]
  );
  
  if (!archive) {
    return NextResponse.json({ error: "存档不存在" }, { status: 404 });
  }
  
  // 解析存档内容
  const archivedMessages = JSON.parse(archive.content_snapshot_json || "[]");
  
  if (archivedMessages.length === 0) {
    return NextResponse.json({ error: "存档内容为空" }, { status: 400 });
  }
  
  // 获取当前会话的最后一条消息时间
  const lastMessage = await db.get(
    `SELECT created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );
  
  // 如果选择"另存为新会话"而不是覆盖
  const body = await request.json();
  const saveAsNew = body.save_as_new || false;
  
  if (saveAsNew) {
    // 创建新的会话并导入存档内容
    const newSessionId = id("session");
    const now = nowIso();
    
    await db.run(
      `INSERT INTO chat_sessions (id, user_id, session_type, title, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newSessionId, userId, archive.session_type, `${archive.name} (恢复副本)`, "active", now, now]
    );
    
    // 导入消息
    for (const msg of archivedMessages) {
      const msgId = id("msg");
      await db.run(
        `INSERT INTO chat_messages (id, session_id, role, content, token_input, token_output, latency_ms, model_name, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [msgId, newSessionId, msg.role, msg.content, msg.token_input || 0, msg.token_output || 0, msg.latency_ms || 0, msg.model_name || "mock-model", msg.created_at]
      );
    }
    
    return NextResponse.json({
      code: 200,
      data: {
        new_session_id: newSessionId,
        message_count: archivedMessages.length,
      },
      msg: "已创建新会话并恢复存档"
    });
  } else {
    // 覆盖当前会话：删除现有消息，导入存档
    await db.run("DELETE FROM chat_messages WHERE session_id = ?", [sessionId]);
    
    // 更新会话时间
    const now = nowIso();
    await db.run(
      "UPDATE chat_sessions SET updated_at = ?, last_message_at = ? WHERE id = ?",
      [now, archivedMessages[archivedMessages.length - 1]?.created_at || now, sessionId]
    );
    
    // 导入存档消息
    for (const msg of archivedMessages) {
      const msgId = id("msg");
      await db.run(
        `INSERT INTO chat_messages (id, session_id, role, content, token_input, token_output, latency_ms, model_name, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [msgId, sessionId, msg.role, msg.content, msg.token_input || 0, msg.token_output || 0, msg.latency_ms || 0, msg.model_name || "mock-model", msg.created_at]
      );
    }
    
    return NextResponse.json({
      code: 200,
      data: {
        session_id: sessionId,
        message_count: archivedMessages.length,
      },
      msg: "存档已恢复到当前会话"
    });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string; archiveId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const { sessionId, archiveId } = params_data;
  
  const db = await getDb();
  
  // 验证存档存在
  const archive = await db.get(
    "SELECT * FROM session_archives WHERE id = ? AND session_id = ? AND user_id = ?",
    [archiveId, sessionId, userId]
  );
  
  if (!archive) {
    return NextResponse.json({ error: "存档不存在" }, { status: 404 });
  }
  
  const archivedMessages = JSON.parse(archive.content_snapshot_json || "[]");
  
  return NextResponse.json({
    code: 200,
    data: {
      archive: {
        id: archive.id,
        session_id: archive.session_id,
        name: archive.name,
        created_at: archive.created_at,
        message_count: archivedMessages.length,
      },
      messages: archivedMessages,
    },
  });
}
