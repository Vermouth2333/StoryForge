import type { Database } from "sqlite";
import { id, nowIso } from "@/lib/db";

/**
 * 会话创建后写入开场语（assistant 首条消息）。
 * 优先用作者填写的 greeting；为空则用兜底文案，保证「系统先发」。
 */
export async function injectOpeningGreeting(
  db: Database,
  args: {
    sessionId: string;
    sessionType: string;
    storyId?: string | null;
    characterId?: string | null;
    worldId?: string | null;
  },
): Promise<{ content: string; messageId: string } | null> {
  let content = "";

  if (args.sessionType === "character" && args.characterId) {
    const row = await db.get<{ name: string; greeting: string }>(
      "SELECT name, greeting FROM characters WHERE id = ?",
      args.characterId,
    );
    if (row) {
      content = (row.greeting ?? "").trim() || `${row.name}注视着你，微微点了点头。「……你来了。」`;
    }
  } else if (args.sessionType === "world" || args.sessionType === "explore") {
    if (args.worldId) {
      const row = await db.get<{ name: string; greeting: string }>(
        "SELECT name, greeting FROM worlds WHERE id = ?",
        args.worldId,
      );
      if (row) {
        content =
          (row.greeting ?? "").trim() ||
          `你踏入了「${row.name}」。风里带着陌生的气息，一段新的探索即将开始。`;
      }
    }
  } else if (args.sessionType === "story" && args.storyId) {
    const story = await db.get<{ title: string; greeting: string }>(
      "SELECT title, greeting FROM stories WHERE id = ?",
      args.storyId,
    );
    if (story) {
      content =
        (story.greeting ?? "").trim() ||
        `故事「${story.title}」的帷幕缓缓拉开。你以自己的身份走进了这个世界……`;
    }
    // 若选了焦点 NPC，可在开场后附一句角色登场感（仅当故事开场为空且角色有开场时替换）
    if (!(story?.greeting ?? "").trim() && args.characterId) {
      const ch = await db.get<{ name: string; greeting: string }>(
        "SELECT name, greeting FROM characters WHERE id = ?",
        args.characterId,
      );
      if (ch?.greeting?.trim()) {
        content = ch.greeting.trim();
      }
    }
  }

  if (!content) return null;

  const messageId = id("msg");
  const now = nowIso();
  await db.run(
    `INSERT INTO chat_messages (id, session_id, role, content, created_at)
     VALUES (?, ?, 'assistant', ?, ?)`,
    messageId,
    args.sessionId,
    content,
    now,
  );
  await db.run(
    "UPDATE chat_sessions SET last_message_at = ?, updated_at = ? WHERE id = ?",
    now,
    now,
    args.sessionId,
  );

  return { content, messageId };
}
