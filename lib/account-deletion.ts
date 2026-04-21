import type { Database } from "sqlite";
import { logBasicSafe } from "@/lib/basic-logs";
import { nowIso } from "@/lib/db";

export type StoryWorksAction = "anonymize_published" | "remove_all";

/**
 * §2.3：注销账号 — 清空个人互动、会话；按选项处理作品；用户行标记 deleted。
 */
export async function executeAccountDeletion(
  db: Database,
  userId: string,
  worksAction: StoryWorksAction,
): Promise<void> {
  const now = nowIso();

  await db.run("DELETE FROM likes WHERE user_id = ?", userId);
  await db.run("DELETE FROM favorites WHERE user_id = ?", userId);
  await db.run("DELETE FROM follows WHERE user_id = ? OR author_id = ?", userId, userId);
  await db.run("DELETE FROM notifications WHERE receiver_user_id = ?", userId);
  await db.run("DELETE FROM feed_impressions WHERE user_id = ?", userId);
  await db.run("DELETE FROM feed_clicks WHERE user_id = ?", userId);

  const sessions = await db.all<{ id: string }[]>(
    "SELECT id FROM chat_sessions WHERE user_id = ?",
    userId,
  );
  for (const s of sessions) {
    await db.run("DELETE FROM chat_messages WHERE session_id = ?", s.id);
    await db.run("DELETE FROM snapshots WHERE session_id = ?", s.id);
  }
  await db.run("DELETE FROM chat_sessions WHERE user_id = ?", userId);

  await db.run("DELETE FROM moderation_items WHERE submitter_user_id = ?", userId);

  if (worksAction === "remove_all") {
    const storyRows = await db.all<{ id: string }[]>(
      "SELECT id FROM stories WHERE author_id = ?",
      userId,
    );
    for (const st of storyRows) {
      await db.run("DELETE FROM likes WHERE target_type = 'story' AND target_id = ?", st.id);
      await db.run("DELETE FROM favorites WHERE target_type = 'story' AND target_id = ?", st.id);
      await db.run("DELETE FROM story_outline_nodes WHERE story_id = ?", st.id);
      await db.run("DELETE FROM character_relations WHERE story_id = ?", st.id);
      await db.run("DELETE FROM story_branches WHERE story_id = ?", st.id);
      await db.run("DELETE FROM stories WHERE id = ?", st.id);
    }

    const charRows = await db.all<{ id: string }[]>(
      "SELECT id FROM characters WHERE author_id = ?",
      userId,
    );
    for (const c of charRows) {
      await db.run("DELETE FROM likes WHERE target_type = 'character' AND target_id = ?", c.id);
      await db.run("DELETE FROM favorites WHERE target_type = 'character' AND target_id = ?", c.id);
      await db.run("DELETE FROM characters WHERE id = ?", c.id);
    }

    const worldRows = await db.all<{ id: string }[]>(
      "SELECT id FROM worlds WHERE author_id = ?",
      userId,
    );
    for (const w of worldRows) {
      await db.run("DELETE FROM likes WHERE target_type = 'world' AND target_id = ?", w.id);
      await db.run("DELETE FROM favorites WHERE target_type = 'world' AND target_id = ?", w.id);
      await db.run("DELETE FROM knowledge_entries WHERE world_id = ?", w.id);
      await db.run("DELETE FROM worlds WHERE id = ?", w.id);
    }
  }

  await db.run(
    `UPDATE users SET status = 'deleted', email = NULL, username = '已注销用户', avatar_url = NULL,
     bio = NULL, phone_masked = NULL, gender = NULL, age = NULL, updated_at = ?
     WHERE id = ?`,
    now,
    userId,
  );

  await logBasicSafe("info", "account deleted", {
    category: "account",
    meta: { userId, worksAction },
    user_id: userId,
  });
}

export async function isUserDeleted(db: Database, userId: string): Promise<boolean> {
  const row = await db.get<{ status: string | null }>(
    "SELECT status FROM users WHERE id = ?",
    userId,
  );
  return row?.status === "deleted";
}
