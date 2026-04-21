import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

const ORDER_SQL: Record<string, Record<string, string>> = {
  story: {
    latest: "s.publish_at DESC",
    updated: "s.updated_at DESC",
    recommended:
      "(s.like_count * 0.40 + s.favorite_count * 0.08 + COALESCE(f.cnt,0) * 0.25 + COALESCE(uf.is_following,0) * 0.2 + (CASE WHEN s.tags_json != '[]' THEN 0.07 ELSE 0 END)) DESC, s.publish_at DESC",
  },
  character: {
    latest: "c.publish_at DESC",
    updated: "c.updated_at DESC",
    recommended:
      "(c.like_count * 0.40 + c.favorite_count * 0.08 + COALESCE(f.cnt,0) * 0.25 + COALESCE(uf.is_following,0) * 0.2 + (CASE WHEN c.tags_json != '[]' THEN 0.07 ELSE 0 END)) DESC, c.publish_at DESC",
  },
  world: {
    latest: "w.publish_at DESC",
    updated: "w.updated_at DESC",
    recommended:
      "(w.like_count * 0.40 + w.favorite_count * 0.08 + COALESCE(f.cnt,0) * 0.25 + COALESCE(uf.is_following,0) * 0.2 + (CASE WHEN w.tags_json != '[]' THEN 0.07 ELSE 0 END)) DESC, w.publish_at DESC",
  },
};

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const url = new URL(req.url);
  const sort = url.searchParams.get("sort") ?? "recommended";
  const kind = url.searchParams.get("kind") ?? "story";

  const orderMap = ORDER_SQL[kind] ?? ORDER_SQL.story;
  const order = orderMap[sort] ?? orderMap.recommended;
  const db = await getDb();

  let items: Record<string, unknown>[];

  if (kind === "character") {
    items = await db.all(
      `SELECT c.id, c.name AS title, c.summary, c.tags_json, c.like_count, c.favorite_count, c.publish_at, c.updated_at, c.author_id,
              CASE WHEN u.status = 'deleted' THEN '已注销用户' ELSE COALESCE(u.username, u.id) END AS author_display,
              'character' AS feed_kind
       FROM characters c
       LEFT JOIN users u ON u.id = c.author_id
       LEFT JOIN (
         SELECT author_id, COUNT(*) cnt FROM follows GROUP BY author_id
       ) f ON f.author_id = c.author_id
       LEFT JOIN (
         SELECT author_id, 1 is_following FROM follows WHERE user_id = ?
       ) uf ON uf.author_id = c.author_id
       WHERE c.status = 'published'
       ORDER BY ${order}
       LIMIT 30`,
      userId,
    );
  } else if (kind === "world") {
    items = await db.all(
      `SELECT w.id, w.name AS title, w.summary, w.tags_json, w.like_count, w.favorite_count, w.publish_at, w.updated_at, w.author_id,
              CASE WHEN u.status = 'deleted' THEN '已注销用户' ELSE COALESCE(u.username, u.id) END AS author_display,
              'world' AS feed_kind, w.cover_asset_id
       FROM worlds w
       LEFT JOIN users u ON u.id = w.author_id
       LEFT JOIN (
         SELECT author_id, COUNT(*) cnt FROM follows GROUP BY author_id
       ) f ON f.author_id = w.author_id
       LEFT JOIN (
         SELECT author_id, 1 is_following FROM follows WHERE user_id = ?
       ) uf ON uf.author_id = w.author_id
       WHERE w.status = 'published'
       ORDER BY ${order}
       LIMIT 30`,
      userId,
    );
  } else {
    items = await db.all(
      `SELECT s.id, s.title, s.summary, s.tags_json, s.like_count, s.favorite_count, s.publish_at, s.updated_at, s.author_id,
              CASE WHEN u.status = 'deleted' THEN '已注销用户' ELSE COALESCE(u.username, u.id) END AS author_display,
              'story' AS feed_kind
       FROM stories s
       LEFT JOIN users u ON u.id = s.author_id
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
  }

  return NextResponse.json({
    code: 200,
    data: { user_id: userId, kind, items },
    msg: "ok",
  });
}
