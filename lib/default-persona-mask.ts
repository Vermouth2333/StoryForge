import type { Database } from "sqlite";
import { id, nowIso } from "@/lib/db";

/** 用于识别系统赠送的默认面具（名称随用户名变化） */
export const DEFAULT_PERSONA_TAG = "系统默认";

/** 全站统一的默认人设内容（名称取用户名，其余字段各用户一致） */
export const DEFAULT_PERSONA_MASK_FIELDS = {
  summary: "当代都市精英，以从容自信的姿态进入故事，与角色互动并推动局面。",
  appearance:
    "眉目清朗、气质出众，衣着得体利落，举止间带着不经意的锋芒，第一眼就会让人记住。",
  personality:
    "谨慎细心，处事大方得体；观察在先、行动在后，既守分寸也不失魄力，待人真诚而有分寸感。",
  background:
    "成长于竞争激烈的现代环境，见多识广，习惯在信息不足时保持冷静判断，亦懂得把握关键时机。",
  speech_style:
    "谈吐清晰利落，用词克制而有力；必要时干脆果断，日常则温和有礼，不做无谓的夸张。",
  tags: [DEFAULT_PERSONA_TAG, "精英"],
} as const;

async function resolveDisplayName(db: Database, userId: string): Promise<string> {
  const user = await db.get<{ username: string | null }>(
    "SELECT username FROM users WHERE id = ?",
    userId,
  );
  return ((user?.username && user.username.trim()) || "旅人").slice(0, 120);
}

/**
 * 若用户尚无系统默认面具，则创建一份：名称为当前用户名，其余配置全站统一。
 * 若仍是旧版「现代人」默认面具，则升级为新配置。
 */
export async function ensureDefaultPersonaMask(db: Database, userId: string): Promise<void> {
  const displayName = await resolveDisplayName(db, userId);
  const now = nowIso();
  const tagsJson = JSON.stringify([...DEFAULT_PERSONA_MASK_FIELDS.tags]);

  const systemDefault = await db.get<{ id: string }>(
    `SELECT id FROM persona_masks
     WHERE user_id = ? AND tags_json LIKE ?
     LIMIT 1`,
    userId,
    `%"${DEFAULT_PERSONA_TAG}"%`,
  );
  if (systemDefault) return;

  const legacy = await db.get<{ id: string }>(
    `SELECT id FROM persona_masks
     WHERE user_id = ? AND (name = '现代人' OR tags_json LIKE '%"默认"%')
     LIMIT 1`,
    userId,
  );
  if (legacy) {
    await db.run(
      `UPDATE persona_masks SET
        name = ?, summary = ?, appearance = ?, personality = ?, background = ?,
        speech_style = ?, tags_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      displayName,
      DEFAULT_PERSONA_MASK_FIELDS.summary,
      DEFAULT_PERSONA_MASK_FIELDS.appearance,
      DEFAULT_PERSONA_MASK_FIELDS.personality,
      DEFAULT_PERSONA_MASK_FIELDS.background,
      DEFAULT_PERSONA_MASK_FIELDS.speech_style,
      tagsJson,
      now,
      legacy.id,
      userId,
    );
    return;
  }

  await db.run(
    `INSERT INTO persona_masks
     (id, user_id, name, summary, appearance, personality, background, speech_style, tags_json, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    id("mask"),
    userId,
    displayName,
    DEFAULT_PERSONA_MASK_FIELDS.summary,
    DEFAULT_PERSONA_MASK_FIELDS.appearance,
    DEFAULT_PERSONA_MASK_FIELDS.personality,
    DEFAULT_PERSONA_MASK_FIELDS.background,
    DEFAULT_PERSONA_MASK_FIELDS.speech_style,
    tagsJson,
    now,
    now,
  );
}
