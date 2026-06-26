import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { canUseCharacterInRelation, orderedCharPair, RELATION_TYPES } from "@/lib/character-relation";
import { getDb, id, nowIso } from "@/lib/db";

const postSchema = z.object({
  character_a_id: z.string().min(1),
  character_b_id: z.string().min(1),
  relation_type: z.enum(RELATION_TYPES),
  description: z.string().max(2000).optional().default(""),
});

async function assertStoryAuthor(
  db: Awaited<ReturnType<typeof getDb>>,
  storyId: string,
  userId: string | null,
) {
  const s = await db.get<{ author_id: string }>("SELECT author_id FROM stories WHERE id = ?", storyId);
  if (!s) return { ok: false as const, reason: "not_found" };
  if (!userId || s.author_id !== userId) return { ok: false as const, reason: "forbidden" };
  return { ok: true as const };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params;
  const userId = await getCurrentUserId();
  const db = await getDb();
  const gate = await assertStoryAuthor(db, storyId, userId);
  if (!gate.ok) {
    const status = gate.reason === "not_found" ? 404 : 403;
    return NextResponse.json(
      { code: status, msg: gate.reason === "not_found" ? "故事不存在" : "无权查看" },
      { status },
    );
  }

  const rows = await db.all(
    `SELECT r.id, r.story_id, r.character_left_id, r.character_right_id,
            r.relation_type, r.description, r.created_at, r.updated_at,
            ca.name AS name_left, cb.name AS name_right
     FROM character_relations r
     LEFT JOIN characters ca ON ca.id = r.character_left_id
     LEFT JOIN characters cb ON cb.id = r.character_right_id
     WHERE r.story_id = ?
     ORDER BY r.updated_at DESC`,
    storyId,
  );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const gate = await assertStoryAuthor(db, storyId, userId);
  if (!gate.ok) {
    const status = gate.reason === "not_found" ? 404 : 403;
    return NextResponse.json(
      { code: status, msg: gate.reason === "not_found" ? "故事不存在" : "无权操作" },
      { status },
    );
  }

  const [left, right] = orderedCharPair(parsed.data.character_a_id, parsed.data.character_b_id);
  if (left === right) {
    return NextResponse.json({ code: 400, msg: "不能将角色与自身建关系" }, { status: 400 });
  }

  const okA = await canUseCharacterInRelation(db, parsed.data.character_a_id, userId);
  const okB = await canUseCharacterInRelation(db, parsed.data.character_b_id, userId);
  if (!okA || !okB) {
    return NextResponse.json({ code: 400, msg: "角色不存在或未发布" }, { status: 400 });
  }

  const rid = id("rel");
  const now = nowIso();
  try {
    await db.run(
      `INSERT INTO character_relations
        (id, story_id, character_left_id, character_right_id, relation_type, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      rid,
      storyId,
      left,
      right,
      parsed.data.relation_type,
      parsed.data.description,
      now,
      now,
    );
  } catch {
    return NextResponse.json({ code: 400, msg: "该角色对已存在关系" }, { status: 400 });
  }

  return NextResponse.json({ code: 200, msg: "已添加", data: { id: rid } });
}
