import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20000).optional(),
  sort_order: z.number().int().min(0).max(1_000_000).optional(),
});

/** PATCH — 更新词条（仅作者） */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id: worldId, entryId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const owned = await db.get<{ id: string }>(
    "SELECT id FROM worlds WHERE id = ? AND author_id = ?",
    worldId,
    userId,
  );
  if (!owned) {
    return NextResponse.json({ code: 403, msg: "仅作者可编辑知识库" }, { status: 403 });
  }

  const entry = await db.get<{ id: string }>(
    "SELECT id FROM knowledge_entries WHERE id = ? AND world_id = ?",
    entryId,
    worldId,
  );
  if (!entry) {
    return NextResponse.json({ code: 404, msg: "词条不存在" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.title !== undefined) {
    fields.push("title = ?");
    values.push(parsed.data.title);
  }
  if (parsed.data.body !== undefined) {
    fields.push("body = ?");
    values.push(parsed.data.body);
  }
  if (parsed.data.sort_order !== undefined) {
    fields.push("sort_order = ?");
    values.push(parsed.data.sort_order);
  }
  if (fields.length === 0) {
    return NextResponse.json({ code: 400, msg: "无更新字段" }, { status: 400 });
  }
  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(entryId);

  await db.run(
    `UPDATE knowledge_entries SET ${fields.join(", ")} WHERE id = ?`,
    ...values,
  );
  return NextResponse.json({ code: 200, msg: "更新成功" });
}

/** DELETE — 删除词条（仅作者） */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id: worldId, entryId } = await params;
  const userId = await getCurrentUserId();

  const db = await getDb();
  const owned = await db.get<{ id: string }>(
    "SELECT id FROM worlds WHERE id = ? AND author_id = ?",
    worldId,
    userId,
  );
  if (!owned) {
    return NextResponse.json({ code: 403, msg: "仅作者可编辑知识库" }, { status: 403 });
  }

  const result = await db.run(
    "DELETE FROM knowledge_entries WHERE id = ? AND world_id = ?",
    entryId,
    worldId,
  );
  if ((result.changes ?? 0) === 0) {
    return NextResponse.json({ code: 404, msg: "词条不存在" }, { status: 404 });
  }
  return NextResponse.json({ code: 200, msg: "已删除" });
}
