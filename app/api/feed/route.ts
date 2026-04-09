import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

const ORDER_SQL: Record<string, string> = {
  latest: "s.publish_at DESC",
  updated: "s.updated_at DESC",
  recommended:
    "(s.like_count * 0.45 + COALESCE(f.cnt,0) * 0.25 + COALESCE(uf.is_following,0) * 0.2 + (CASE WHEN s.tags_json != '[]' THEN 0.1 ELSE 0 END)) DESC, s.publish_at DESC",
};

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const url = new URL(req.url);
  const sort = url.searchParams.get("sort") ?? "recommended";
  const order = ORDER_SQL[sort] ?? ORDER_SQL.recommended;
  const db = await getDb();
  const items = await db.all(
    `SELECT s.id, s.title, s.summary, s.tags_json, s.like_count, s.publish_at, s.updated_at, s.author_id
     FROM stories s
     LEFT JOIN (
       SELECT author_id, COUNT(*) cnt FROM follows GROUP BY author_id
     ) f ON f.author_id = s.author_id
     LEFT JOIN (
       SELECT author_id, 1 is_following FROM follows WHERE user_id = ?
     ) uf ON uf.author_id = s.author_id
     WHERE s.status = 'published'
     ORDER BY ${order}
     LIMIT 30`,
    userId,
  );

  return NextResponse.json({ code: 200, data: { user_id: userId, items }, msg: "ok" });
}
