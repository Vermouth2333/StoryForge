import type { Database } from "sqlite";

/**
 * 发布市场前的敏感片段。命中则进入审核台，不直接上架。
 * 只收录明确违法或侵害未成年人的表述，避免误伤普通角色扮演/小说情节。
 */
export const MVP_BANNED_FRAGMENTS: string[] = [
  "违禁",
  // 侵害未成年人
  "儿童色情",
  "未成年色情",
  "恋童",
  "童癖",
  "幼女性交",
  "奸幼",
  "child porn",
  "childporn",
  // 毒品交易与制毒
  "贩卖毒品",
  "冰毒",
  "海洛因",
  "氯胺酮",
  "甲基苯丙胺",
  "制毒方法",
  "毒品配方",
  // 枪爆违法交易
  "买卖枪支",
  "出售枪支",
  "自制炸弹",
  "爆炸物制作",
  "制作炸药",
  "枪支弹药",
  // 诈骗与黑产
  "洗钱服务",
  "银行卡买卖",
  "四件套银行卡",
  "假钞",
  "假币",
  "办假证",
  "身份证代办",
  "钓鱼网站",
  "电信诈骗教程",
  // 人口与强迫
  "强迫卖淫",
  "人口贩卖",
  "拐卖妇女",
  "人体器官买卖",
  // 暴恐实操
  "恐怖袭击教程",
  "人体炸弹",
];

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
  const haystack = combined.toLowerCase();
  for (const frag of MVP_BANNED_FRAGMENTS) {
    if (frag && haystack.includes(frag.toLowerCase())) {
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
