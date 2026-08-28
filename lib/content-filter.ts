import type { Database } from "sqlite";

/**
 * MVP 敏感词片段（可后续改为配置/DB）。命中则进入审核台，不直接上架市场。
 * 与历史硬编码「违禁」检测保持同一规则。
 */
export const MVP_BANNED_FRAGMENTS: string[] = ["违禁"];

export type ScanResult =
  | { ok: true }
  | { ok: false; reason: "too_long" | "sensitive"; msg: string };

export function scanTextBundle(
  parts: Array<string | null | undefined>,
  maxTotalLen = 500_000,
): ScanResult {
  const combined = parts
    .filter((p) => p != null && String(p).length > 0)
    .map((p) => String(p))
    .join("\n");
  if (combined.length > maxTotalLen) {
    return { ok: false, reason: "too_long", msg: "发布内容总长度超出限制" };
  }
  for (const frag of MVP_BANNED_FRAGMENTS) {
    if (frag && combined.includes(frag)) {
      return {
        ok: false,
        reason: "sensitive",
        msg: "内容含敏感词，已提交管理员审核，通过后才会出现在市场",
      };
    }
  }
  return { ok: true };
}

export async function storyPublishTextParts(
  db: Database,
  storyId: string,
): Promise<Array<string | null | undefined>> {
  const row = await db.get<{
    title: string;
    summary: string;
    greeting: string | null;
    tags_json: string;
  }>("SELECT title, summary, greeting, tags_json FROM stories WHERE id = ?", storyId);
  if (!row) return [];
  const nodes = await db.all<
    { title: string | null; content: string | null }[]
  >("SELECT title, content FROM story_outline_nodes WHERE story_id = ?", storyId);
  const parts: Array<string | null | undefined> = [row.title, row.summary, row.greeting, row.tags_json];
  for (const n of nodes) {
    parts.push(n.title, n.content);
  }
  return parts;
}

export async function characterPublishTextParts(
  db: Database,
  characterId: string,
): Promise<Array<string | null | undefined>> {
  const row = await db.get<Record<string, string | null>>(
    `SELECT name, summary, personality, appearance, background, speech_style, likes_dislikes, greeting, tags_json
     FROM characters WHERE id = ?`,
    characterId,
  );
  if (!row) return [];
  return Object.values(row);
}

export async function worldPublishTextParts(
  db: Database,
  worldId: string,
): Promise<Array<string | null | undefined>> {
  const row = await db.get<Record<string, string | null>>(
    "SELECT name, summary, setting_notes, greeting, tags_json FROM worlds WHERE id = ?",
    worldId,
  );
  if (!row) return [];
  return Object.values(row);
}
