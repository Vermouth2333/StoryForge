import type { Database } from "sqlite";

/**
 * MVP 敏感词片段（可后续改为配置/DB）。命中则拒绝发布。
 * 与历史硬编码「违禁」检测保持同一规则。
 */
export const MVP_BANNED_FRAGMENTS: string[] = ["违禁"];

export function scanTextBundle(
  parts: Array<string | null | undefined>,
  maxTotalLen = 500_000,
): { ok: true } | { ok: false; msg: string } {
  const combined = parts
    .filter((p) => p != null && String(p).length > 0)
    .map((p) => String(p))
    .join("\n");
  if (combined.length > maxTotalLen) {
    return { ok: false, msg: "发布内容总长度超出限制" };
  }
  for (const frag of MVP_BANNED_FRAGMENTS) {
    if (frag && combined.includes(frag)) {
      return { ok: false, msg: "基础安全过滤未通过，请修改文本后重试" };
    }
  }
  return { ok: true };
}

export async function storyPublishTextParts(
  db: Database,
  storyId: string,
): Promise<string[]> {
  const row = await db.get<{
    title: string;
    summary: string;
    tags_json: string;
  }>("SELECT title, summary, tags_json FROM stories WHERE id = ?", storyId);
  if (!row) return [];
  const nodes = await db.all<
    { title: string; content: string }[]
  >("SELECT title, content FROM story_outline_nodes WHERE story_id = ?", storyId);
  const parts: string[] = [row.title, row.summary, row.tags_json];
  for (const n of nodes) {
    parts.push(n.title, n.content);
  }
  return parts;
}
