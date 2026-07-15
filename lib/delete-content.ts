import type { Database } from "sqlite";

async function purgeChatSessionData(db: Database, sessionId: string) {
  await db.run("DELETE FROM chat_messages WHERE session_id = ?", sessionId);
  await db.run("DELETE FROM snapshots WHERE session_id = ?", sessionId);
  await db.run("DELETE FROM session_archives WHERE session_id = ?", sessionId);
}

async function deleteChatSessionsForContent(
  db: Database,
  field: "story_id" | "character_id" | "world_id",
  value: string,
) {
  const sessions = await db.all<{ id: string }[]>(
    `SELECT id FROM chat_sessions WHERE ${field} = ?`,
    value,
  );
  for (const s of sessions) {
    await purgeChatSessionData(db, s.id);
  }
  await db.run(`DELETE FROM chat_sessions WHERE ${field} = ?`, value);
}

export async function deleteChatSession(
  db: Database,
  sessionId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; msg: string }> {
  const session = await db.get<{ id: string; user_id: string }>(
    "SELECT id, user_id FROM chat_sessions WHERE id = ?",
    sessionId,
  );
  if (!session || session.user_id !== userId) {
    return { ok: false, msg: "会话不存在" };
  }
  await purgeChatSessionData(db, sessionId);
  await db.run("DELETE FROM chat_sessions WHERE id = ?", sessionId);
  return { ok: true };
}

async function deleteAssetsForTarget(db: Database, targetType: string, targetId: string) {
  await db.run("DELETE FROM assets WHERE target_type = ? AND target_id = ?", targetType, targetId);
}

export async function deleteStory(
  db: Database,
  storyId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; msg: string }> {
  const story = await db.get<{ id: string; status: string; author_id: string }>(
    "SELECT id, status, author_id FROM stories WHERE id = ?",
    storyId,
  );
  if (!story || story.author_id !== userId) {
    return { ok: false, msg: "故事不存在" };
  }
  if (story.status === "published") {
    return { ok: false, msg: "已发布的故事请先下架再删除" };
  }

  const branches = await db.all<{ id: string }[]>(
    "SELECT id FROM story_branches WHERE story_id = ?",
    storyId,
  );
  for (const b of branches) {
    await db.run("DELETE FROM branch_nodes WHERE branch_id = ?", b.id);
  }
  await db.run("DELETE FROM story_branches WHERE story_id = ?", storyId);
  await db.run("DELETE FROM story_outline_nodes WHERE story_id = ?", storyId);
  await db.run("DELETE FROM character_relations WHERE story_id = ?", storyId);
  await db.run("DELETE FROM story_characters WHERE story_id = ?", storyId);
  await db.run("DELETE FROM story_worlds WHERE story_id = ?", storyId);
  await db.run("DELETE FROM story_style_anchors WHERE story_id = ?", storyId);
  await db.run("DELETE FROM consistency_check_logs WHERE story_id = ?", storyId);
  await db.run(
    `DELETE FROM derivative_relations
     WHERE (derived_work_type = 'story' AND derived_work_id = ?)
        OR (original_work_type = 'story' AND original_work_id = ?)`,
    storyId,
    storyId,
  );
  await db.run("DELETE FROM conflict_detection_logs WHERE story_id = ?", storyId);
  await db.run("DELETE FROM feed_impressions WHERE story_id = ?", storyId);
  await db.run("DELETE FROM feed_clicks WHERE story_id = ?", storyId);
  await db.run("DELETE FROM likes WHERE target_type = 'story' AND target_id = ?", storyId);
  await db.run("DELETE FROM favorites WHERE target_type = 'story' AND target_id = ?", storyId);
  await db.run("DELETE FROM reviews WHERE target_type = 'story' AND target_id = ?", storyId);
  await db.run(
    "DELETE FROM rag_vectors WHERE resource_type = 'story' AND resource_id = ?",
    storyId,
  );
  await deleteChatSessionsForContent(db, "story_id", storyId);
  await deleteAssetsForTarget(db, "story", storyId);
  await db.run("DELETE FROM stories WHERE id = ?", storyId);
  return { ok: true };
}

export async function deleteCharacter(
  db: Database,
  characterId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; msg: string }> {
  const row = await db.get<{ id: string; status: string; author_id: string }>(
    "SELECT id, status, author_id FROM characters WHERE id = ?",
    characterId,
  );
  if (!row || row.author_id !== userId) {
    return { ok: false, msg: "角色不存在" };
  }
  if (row.status === "published") {
    return { ok: false, msg: "已发布的角色请先下架再删除" };
  }

  const linked = await db.get<{ story_id: string }>(
    "SELECT story_id FROM story_characters WHERE character_id = ? LIMIT 1",
    characterId,
  );
  if (linked) {
    return { ok: false, msg: "该角色已关联到故事，请先从故事中移除后再删除" };
  }

  await db.run("DELETE FROM conflict_detection_logs WHERE character_id = ?", characterId);
  await db.run(
    `DELETE FROM derivative_relations
     WHERE (derived_work_type = 'character' AND derived_work_id = ?)
        OR (original_work_type = 'character' AND original_work_id = ?)`,
    characterId,
    characterId,
  );
  await db.run("DELETE FROM likes WHERE target_type = 'character' AND target_id = ?", characterId);
  await db.run(
    "DELETE FROM favorites WHERE target_type = 'character' AND target_id = ?",
    characterId,
  );
  await db.run(
    "DELETE FROM reviews WHERE target_type = 'character' AND target_id = ?",
    characterId,
  );
  await deleteChatSessionsForContent(db, "character_id", characterId);
  await deleteAssetsForTarget(db, "character", characterId);
  await db.run("DELETE FROM characters WHERE id = ?", characterId);
  return { ok: true };
}

export async function deleteWorld(
  db: Database,
  worldId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; msg: string }> {
  const row = await db.get<{ id: string; status: string; author_id: string }>(
    "SELECT id, status, author_id FROM worlds WHERE id = ?",
    worldId,
  );
  if (!row || row.author_id !== userId) {
    return { ok: false, msg: "世界不存在" };
  }
  if (row.status === "published") {
    return { ok: false, msg: "已发布的世界请先下架再删除" };
  }

  const linked = await db.get<{ story_id: string }>(
    "SELECT story_id FROM story_worlds WHERE world_id = ? LIMIT 1",
    worldId,
  );
  if (linked) {
    return { ok: false, msg: "该世界已关联到故事，请先从故事中移除后再删除" };
  }

  await db.run("DELETE FROM knowledge_entries WHERE world_id = ?", worldId);
  await db.run("DELETE FROM conflict_detection_logs WHERE world_id = ?", worldId);
  await db.run(
    `DELETE FROM derivative_relations
     WHERE (derived_work_type = 'world' AND derived_work_id = ?)
        OR (original_work_type = 'world' AND original_work_id = ?)`,
    worldId,
    worldId,
  );
  await db.run("DELETE FROM likes WHERE target_type = 'world' AND target_id = ?", worldId);
  await db.run("DELETE FROM favorites WHERE target_type = 'world' AND target_id = ?", worldId);
  await db.run("DELETE FROM reviews WHERE target_type = 'world' AND target_id = ?", worldId);
  await db.run("DELETE FROM rag_vectors WHERE world_id = ?", worldId);
  await deleteChatSessionsForContent(db, "world_id", worldId);
  await deleteAssetsForTarget(db, "world", worldId);
  await db.run("DELETE FROM worlds WHERE id = ?", worldId);
  return { ok: true };
}
