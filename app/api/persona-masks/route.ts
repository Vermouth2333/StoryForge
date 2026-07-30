import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";
import { ensureDefaultPersonaMask } from "@/lib/default-persona-mask";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  summary: z.string().max(1000).optional().default(""),
  appearance: z.string().max(2000).optional().default(""),
  personality: z.string().max(8000).optional().default(""),
  background: z.string().max(4000).optional().default(""),
  speech_style: z.string().max(2000).optional().default(""),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  avatar_url: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const db = await getDb();
  await ensureDefaultPersonaMask(db, userId);
  const rows = await db.all(
    `SELECT id, name, summary, appearance, personality, background, speech_style,
            tags_json, avatar_url, created_at, updated_at
     FROM persona_masks
     WHERE user_id = ?
     ORDER BY CASE WHEN tags_json LIKE '%"系统默认"%' THEN 0 ELSE 1 END, updated_at DESC
     LIMIT 100`,
    userId,
  );
  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const db = await getDb();
  const maskId = id("mask");
  const now = nowIso();
  await db.run(
    `INSERT INTO persona_masks
     (id, user_id, name, summary, appearance, personality, background, speech_style, tags_json, avatar_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    maskId,
    userId,
    parsed.data.name,
    parsed.data.summary,
    parsed.data.appearance,
    parsed.data.personality,
    parsed.data.background,
    parsed.data.speech_style,
    JSON.stringify(parsed.data.tags),
    parsed.data.avatar_url ?? null,
    now,
    now,
  );
  return NextResponse.json({
    code: 200,
    msg: "创建成功",
    data: { id: maskId, created_at: now },
  });
}
