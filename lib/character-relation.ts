import type { Database } from "sqlite";

export const RELATION_TYPES = [
  "敌对",
  "盟友",
  "亲属",
  "恋人",
  "上下级",
  "合作",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export function orderedCharPair(a: string, b: string): [string, string] {
  if (a === b) return [a, b];
  return a < b ? [a, b] : [b, a];
}

export async function canUseCharacterInRelation(
  db: Database,
  characterId: string,
  userId: string | null,
): Promise<boolean> {
  const r = await db.get<{ author_id: string; status: string }>(
    "SELECT author_id, status FROM characters WHERE id = ?",
    characterId,
  );
  return Boolean(r && (r.status === "published" || (userId && r.author_id === userId)));
}
