import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const schema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().max(1000).optional().default(""),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
});

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";
  const db = await getDb();

  const rows = mine
    ? await db.all(
        `SELECT id, title, summary, status, like_count, publish_at, updated_at
         FROM stories
         WHERE author_id = ?
         ORDER BY updated_at DESC
         LIMIT 100`,
        userId,
      )
    : await db.all(
        `SELECT id, title, summary, status, like_count, publish_at, updated_at
         FROM stories
         WHERE status = 'published'
         ORDER BY publish_at DESC
         LIMIT 100`,
      );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
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
     (id, author_id, title, summary, tags_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
    storyId,
    userId,
    parsed.data.title,
    parsed.data.summary,
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
