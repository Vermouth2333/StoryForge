import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  summary: z.string().max(1000).optional().default(""),
  setting_notes: z.string().max(8000).optional().default(""),
  cover_asset_id: z.string().max(120).optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
});

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";
  const db = await getDb();

  const rows = mine
    ? await db.all(
        `SELECT id, author_id, name, cover_asset_id, summary, setting_notes, tags_json, status, like_count, publish_at, updated_at
         FROM worlds
         WHERE author_id = ?
         ORDER BY updated_at DESC
         LIMIT 100`,
        userId,
      )
    : await db.all(
        `SELECT id, author_id, name, cover_asset_id, summary, setting_notes, tags_json, status, like_count, publish_at, updated_at
         FROM worlds
         WHERE status = 'published'
         ORDER BY publish_at DESC
         LIMIT 100`,
      );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  const db = await getDb();
  const wid = id("world");
  const now = nowIso();
  await db.run(
    `INSERT INTO worlds
     (id, author_id, name, cover_asset_id, summary, setting_notes, tags_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    wid,
    userId,
    parsed.data.name,
    parsed.data.cover_asset_id ?? null,
    parsed.data.summary,
    parsed.data.setting_notes,
    JSON.stringify(parsed.data.tags),
    now,
    now,
  );
  return NextResponse.json({
    code: 200,
    msg: "创建成功",
    data: { id: wid, status: "draft", created_at: now },
  });
}
