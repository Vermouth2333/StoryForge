import type { Database } from "sqlite";
import { id, nowIso } from "@/lib/db";

/** 好感档位：0–100 映射到展示文案 */
export const AFFINITY_STAGES = [
  { min: 0, max: 19, key: "stranger", label: "陌生" },
  { min: 20, max: 39, key: "acquaintance", label: "认识" },
  { min: 40, max: 59, key: "friendly", label: "友好" },
  { min: 60, max: 79, key: "trusted", label: "信赖" },
  { min: 80, max: 100, key: "bond", label: "羁绊" },
] as const;

export function affinityStage(score: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stage = AFFINITY_STAGES.find((s) => clamped >= s.min && clamped <= s.max) ?? AFFINITY_STAGES[0];
  return { score: clamped, ...stage };
}

function storyKey(storyId: string | null | undefined) {
  return storyId?.trim() ? storyId.trim() : "";
}

export async function getAffinity(
  db: Database,
  userId: string,
  characterId: string,
  storyId?: string | null,
) {
  const sid = storyKey(storyId);
  const row = await db.get<{ score: number }>(
    `SELECT score FROM affinity_scores
     WHERE user_id = ? AND character_id = ? AND story_id = ?`,
    userId,
    characterId,
    sid,
  );
  return affinityStage(row?.score ?? 0);
}

export async function adjustAffinity(
  db: Database,
  userId: string,
  characterId: string,
  storyId: string | null | undefined,
  delta: number,
) {
  const sid = storyKey(storyId);
  const now = nowIso();
  const existing = await db.get<{ id: string; score: number }>(
    `SELECT id, score FROM affinity_scores
     WHERE user_id = ? AND character_id = ? AND story_id = ?`,
    userId,
    characterId,
    sid,
  );
  const next = affinityStage((existing?.score ?? 0) + delta);
  if (existing) {
    await db.run(
      "UPDATE affinity_scores SET score = ?, updated_at = ? WHERE id = ?",
      next.score,
      now,
      existing.id,
    );
  } else {
    await db.run(
      `INSERT INTO affinity_scores (id, user_id, character_id, story_id, score, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id("aff"),
      userId,
      characterId,
      sid,
      next.score,
      now,
    );
  }
  return next;
}

/** 每轮有效互动默认 +2；含冲突/冷淡关键词时 -1 */
export function estimateAffinityDelta(userText: string): number {
  const t = userText.toLowerCase();
  if (/滚|讨厌|恨|去死|闭嘴|无聊|烦/.test(t)) return -2;
  if (/喜欢|谢谢|关心|抱歉|喜欢你|想你|送你|礼物/.test(t)) return 3;
  return 2;
}
