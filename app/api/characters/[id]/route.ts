import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  summary: z.string().max(1000).optional(),
  personality: z.string().max(8000).optional(),
  avatar_url: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = await getDb();
  const row = await db.get<Record<string, unknown>>(
    `SELECT c.id, c.author_id,
      CASE WHEN u.status = 'deleted' THEN '已注销用户' ELSE COALESCE(u.username, u.id) END AS author_display,
      c.name, c.avatar_url, c.summary, c.personality, c.tags_json, c.status, c.like_count, c.publish_at, c.updated_at
     FROM characters c
     LEFT JOIN users u ON u.id = c.author_id
     WHERE c.id = ?`,
    id,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "角色不存在" }, { status: 404 });
  }
  return NextResponse.json({ code: 200, data: row, msg: "ok" });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const owned = await db.get<{ id: string }>(
    "SELECT id FROM characters WHERE id = ? AND author_id = ?",
    id,
    userId,
  );
  if (!owned) {
    return NextResponse.json({ code: 404, msg: "角色不存在" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.name !== undefined) {
    fields.push("name = ?");
    values.push(parsed.data.name);
  }
  if (parsed.data.summary !== undefined) {
    fields.push("summary = ?");
    values.push(parsed.data.summary);
  }
  if (parsed.data.personality !== undefined) {
    fields.push("personality = ?");
    values.push(parsed.data.personality);
  }
  if (parsed.data.avatar_url !== undefined) {
    fields.push("avatar_url = ?");
    values.push(parsed.data.avatar_url);
  }
  if (parsed.data.tags !== undefined) {
    fields.push("tags_json = ?");
    values.push(JSON.stringify(parsed.data.tags));
  }
  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(id);

  await db.run(`UPDATE characters SET ${fields.join(", ")} WHERE id = ?`, ...values);
  return NextResponse.json({ code: 200, msg: "更新成功" });
}
