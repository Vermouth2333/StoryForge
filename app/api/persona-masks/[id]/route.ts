import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  summary: z.string().max(1000).optional(),
  appearance: z.string().max(2000).optional(),
  personality: z.string().max(8000).optional(),
  background: z.string().max(4000).optional(),
  speech_style: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  avatar_url: z.string().max(2000).nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const db = await getDb();
  const row = await db.get(
    `SELECT id, name, summary, appearance, personality, background, speech_style,
            tags_json, avatar_url, created_at, updated_at
     FROM persona_masks WHERE id = ? AND user_id = ?`,
    id,
    userId,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "人设面具不存在" }, { status: 404 });
  }
  return NextResponse.json({ code: 200, data: row, msg: "ok" });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const db = await getDb();
  const owned = await db.get<{ id: string }>(
    "SELECT id FROM persona_masks WHERE id = ? AND user_id = ?",
    id,
    userId,
  );
  if (!owned) {
    return NextResponse.json({ code: 404, msg: "人设面具不存在" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const p = parsed.data;
  if (p.name !== undefined) {
    fields.push("name = ?");
    values.push(p.name);
  }
  if (p.summary !== undefined) {
    fields.push("summary = ?");
    values.push(p.summary);
  }
  if (p.appearance !== undefined) {
    fields.push("appearance = ?");
    values.push(p.appearance);
  }
  if (p.personality !== undefined) {
    fields.push("personality = ?");
    values.push(p.personality);
  }
  if (p.background !== undefined) {
    fields.push("background = ?");
    values.push(p.background);
  }
  if (p.speech_style !== undefined) {
    fields.push("speech_style = ?");
    values.push(p.speech_style);
  }
  if (p.tags !== undefined) {
    fields.push("tags_json = ?");
    values.push(JSON.stringify(p.tags));
  }
  if (p.avatar_url !== undefined) {
    fields.push("avatar_url = ?");
    values.push(p.avatar_url);
  }
  if (fields.length === 0) {
    return NextResponse.json({ code: 400, msg: "无更新字段" }, { status: 400 });
  }
  const now = nowIso();
  fields.push("updated_at = ?");
  values.push(now, id, userId);
  await db.run(
    `UPDATE persona_masks SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    ...values,
  );
  return NextResponse.json({ code: 200, msg: "更新成功" });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const db = await getDb();
  const owned = await db.get<{ id: string }>(
    "SELECT id FROM persona_masks WHERE id = ? AND user_id = ?",
    id,
    userId,
  );
  if (!owned) {
    return NextResponse.json({ code: 404, msg: "人设面具不存在" }, { status: 404 });
  }
  // 软解绑：历史会话保留 persona_mask_id，但面具行删除后新会话不可再选
  await db.run("DELETE FROM persona_masks WHERE id = ? AND user_id = ?", id, userId);
  return NextResponse.json({ code: 200, msg: "已删除" });
}
