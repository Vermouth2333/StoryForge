import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CacheService, cacheKeys } from "@/lib/cache";

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
  const search = url.searchParams.get("search") ?? "";
  const tagsParam = url.searchParams.get("tags") ?? "";
  const author = url.searchParams.get("author") ?? "";
  const minRating = url.searchParams.get("minRating") ?? "";
  const startDate = url.searchParams.get("startDate") ?? "";
  const endDate = url.searchParams.get("endDate") ?? "";

  const tags = tagsParam ? tagsParam.split(",").filter(t => t.trim()) : [];
  
  const cacheKey = cacheKeys.feed(`${kind}-${sort}-${search}-${tagsParam}-${author}-${minRating}`);
  const cached = await CacheService.get<any>(cacheKey);
  if (cached) {
    return NextResponse.json({
      code: 200,
      data: cached,
      msg: "ok",
      fromCache: true,
    });
  }

  const orderMap = ORDER_SQL[kind] ?? ORDER_SQL.story;
  const order = orderMap[sort] ?? orderMap.recommended;
  const db = await getDb();

  let items: Record<string, unknown>[];
  const params: any[] = [];
  let whereConditions: string[] = [];

  if (userId) {
    params.push(userId);
  }

  if (kind === "character") {
    whereConditions.push("c.status = 'published'");
    
    if (search) {
      whereConditions.push("(c.name LIKE ? OR c.summary LIKE ?)");
      params.push(`%${search}%`);
    }
    
    if (author) {
      whereConditions.push("c.author_id = ?");
    }

    if (tags.length > 0) {
      const tagConditions = tags.map(() => "c.tags_json LIKE ?").join(" AND ");
      whereConditions.push(tagConditions);
      tags.forEach(tag => params.push(`%${tag}%`));
    }

    if (startDate) {
      whereConditions.push("c.publish_at >= ?");
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push("c.publish_at <= ?");
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

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
       ${whereClause}
       ORDER BY ${order}
       LIMIT 30`,
      ...params,
    );
  } else if (kind === "world") {
    whereConditions.push("w.status = 'published'");
    
    if (search) {
      whereConditions.push("(w.name LIKE ? OR w.summary LIKE ?)");
      params.push(`%${search}%`);
    }
    
    if (author) {
      whereConditions.push("w.author_id = ?");
    }

    if (tags.length > 0) {
      const tagConditions = tags.map(() => "w.tags_json LIKE ?").join(" AND ");
      whereConditions.push(tagConditions);
      tags.forEach(tag => params.push(`%${tag}%`));
    }

    if (startDate) {
      whereConditions.push("w.publish_at >= ?");
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push("w.publish_at <= ?");
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

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
       ${whereClause}
       ORDER BY ${order}
       LIMIT 30`,
      ...params,
    );
  } else {
    whereConditions.push("s.status = 'published'");
    
    if (search) {
      whereConditions.push("(s.title LIKE ? OR s.summary LIKE ?)");
      params.push(`%${search}%`);
    }
    
    if (author) {
      whereConditions.push("s.author_id = ?");
    }

    if (tags.length > 0) {
      const tagConditions = tags.map(() => "s.tags_json LIKE ?").join(" AND ");
      whereConditions.push(tagConditions);
      tags.forEach(tag => params.push(`%${tag}%`));
    }

    if (minRating) {
      const rating = parseFloat(minRating);
      if (!isNaN(rating)) {
        whereConditions.push(`(s.like_count + s.favorite_count) >= ?`);
        params.push(rating * 10);
      }
    }

    if (startDate) {
      whereConditions.push("s.publish_at >= ?");
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push("s.publish_at <= ?");
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

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
       ${whereClause}
       ORDER BY ${order}
       LIMIT 30`,
      ...params,
    );
  }

  const data = { user_id: userId, kind, items };
  await CacheService.set(cacheKey, data, { ttlSeconds: 300 });

  return NextResponse.json({
    code: 200,
    data,
    msg: "ok",
  });
}
