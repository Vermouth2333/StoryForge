import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";
import { likeContains, parseMineListParams } from "@/lib/mine-list-query";

const schema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().max(1000).optional().default(""),
  greeting: z.string().max(2000).optional().default(""),
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
  const searchSql = q ? " AND (title LIKE ? OR IFNULL(summary,'') LIKE ?)" : "";
  if (q) {
    const like = likeContains(q);
    params.push(like, like);
  }

  const countRow = await db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM stories WHERE ${where}${searchSql}`,
    ...params,
  );
  const total = Number(countRow?.c ?? 0);

  const rows = await db.all(
    mine
      ? `SELECT id, title, summary, status, like_count, publish_at, updated_at, source_work_id, cover_asset_id
         FROM stories
         WHERE ${where}${searchSql}
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`
      : `SELECT id, title, summary, status, like_count, publish_at, updated_at, cover_asset_id
         FROM stories
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  const db = await getDb();
  const storyId = id("story");
  const now = nowIso();
  await db.run(
    `INSERT INTO stories
     (id, author_id, title, summary, greeting, tags_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    storyId,
    userId,
    parsed.data.title,
    parsed.data.summary,
    parsed.data.greeting,
    JSON.stringify(parsed.data.tags),
    now,
    now,
  );
  return NextResponse.json({
    code: 200,
    msg: "创建成功",
    data: { id: storyId, status: "draft", created_at: now },
  });
}
