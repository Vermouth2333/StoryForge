import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";
import { likeContains, parseMineListParams } from "@/lib/mine-list-query";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  summary: z.string().max(1000).optional().default(""),
  personality: z.string().max(8000).optional().default(""),
  appearance: z.string().max(2000).optional().default(""),
  background: z.string().max(4000).optional().default(""),
  speech_style: z.string().max(2000).optional().default(""),
  likes_dislikes: z.string().max(2000).optional().default(""),
  greeting: z.string().max(2000).optional().default(""),
  avatar_url: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
});

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";
  const { q, page, pageSize, offset } = parseMineListParams(url);
  const db = await getDb();

  if (mine && !userId) {
    return NextResponse.json({ code: 200, data: [], total: 0, page, page_size: pageSize, msg: "ok" });
  }

  const where = mine ? "author_id = ?" : "status = 'published'";
  const params: Array<string | number> = mine ? [userId as string] : [];
  const searchSql = q ? " AND (name LIKE ? OR IFNULL(summary,'') LIKE ?)" : "";
  if (q) {
    const like = likeContains(q);
    params.push(like, like);
  }

  const countRow = await db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM characters WHERE ${where}${searchSql}`,
    ...params,
  );
  const total = Number(countRow?.c ?? 0);

  const rows = await db.all(
    mine
      ? `SELECT id, author_id, name, avatar_url, cover_asset_id, summary, personality, tags_json, status, like_count, publish_at, updated_at, source_work_id
         FROM characters
         WHERE ${where}${searchSql}
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`
      : `SELECT id, author_id, name, avatar_url, cover_asset_id, summary, personality, tags_json, status, like_count, publish_at, updated_at
         FROM characters
         WHERE ${where}${searchSql}
         ORDER BY publish_at DESC
         LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset,
  );

  const data = (rows as Array<Record<string, unknown>>).map((row) => {
    const coverAssetId = row.cover_asset_id ? String(row.cover_asset_id) : null;
    return {
      ...row,
      cover_url: coverAssetId ? `/api/assets/${coverAssetId}/file` : null,
      cover_thumbnail_url: coverAssetId ? `/api/assets/${coverAssetId}/thumbnail` : null,
    };
  });

  return NextResponse.json({ code: 200, data, total, page, page_size: pageSize, msg: "ok" });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  const db = await getDb();
  const cid = id("char");
  const now = nowIso();
  await db.run(
    `INSERT INTO characters
     (id, author_id, name, avatar_url, summary, personality, appearance, background,
      speech_style, likes_dislikes, greeting, tags_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    cid,
    userId,
    parsed.data.name,
    parsed.data.avatar_url ?? null,
    parsed.data.summary,
    parsed.data.personality,
    parsed.data.appearance,
    parsed.data.background,
    parsed.data.speech_style,
    parsed.data.likes_dislikes,
    parsed.data.greeting,
    JSON.stringify(parsed.data.tags),
    now,
    now,
  );
  return NextResponse.json({
    code: 200,
    msg: "创建成功",
    data: { id: cid, status: "draft", created_at: now },
  });
}
