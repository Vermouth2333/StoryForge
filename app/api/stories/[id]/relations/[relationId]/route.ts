import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { RELATION_TYPES } from "@/lib/character-relation";
import { getDb, nowIso } from "@/lib/db";

const patchSchema = z.object({
  relation_type: z.enum(RELATION_TYPES).optional(),
  description: z.string().max(2000).optional(),
});

async function assertStoryAuthor(
  db: Awaited<ReturnType<typeof getDb>>,
  storyId: string,
  userId: string,
) {
  const s = await db.get<{ author_id: string }>("SELECT author_id FROM stories WHERE id = ?", storyId);
  if (!s) return { ok: false as const, reason: "not_found" };
  if (s.author_id !== userId) return { ok: false as const, reason: "forbidden" };
  return { ok: true as const };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; relationId: string }> },
) {
  const { id: storyId, relationId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
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

  const row = await db.get<{ id: string }>(
    "SELECT id FROM character_relations WHERE id = ? AND story_id = ?",
    relationId,
    storyId,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "记录不存在" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.relation_type !== undefined) {
    fields.push("relation_type = ?");
    values.push(parsed.data.relation_type);
  }
  if (parsed.data.description !== undefined) {
    fields.push("description = ?");
    values.push(parsed.data.description);
  }
  if (fields.length === 0) {
    return NextResponse.json({ code: 400, msg: "无更新项" }, { status: 400 });
  }
  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(relationId, storyId);

  await db.run(
    `UPDATE character_relations SET ${fields.join(", ")} WHERE id = ? AND story_id = ?`,
    ...values,
  );
  return NextResponse.json({ code: 200, msg: "更新成功" });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; relationId: string }> },
) {
  const { id: storyId, relationId } = await params;
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

  const r = await db.run(
    "DELETE FROM character_relations WHERE id = ? AND story_id = ?",
    relationId,
    storyId,
  );
  if (r.changes === 0) {
    return NextResponse.json({ code: 404, msg: "记录不存在" }, { status: 404 });
  }
  return NextResponse.json({ code: 200, msg: "已删除" });
}
