import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ authorId: string }> }
) {
  try {
    const { authorId } = await params;
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Number(url.searchParams.get("page_size") || "20"));
    const offset = (page - 1) * pageSize;

    const db = await getDb();

    const user = await db.get<{ id: string; username: string; status: string }>(
      "SELECT id, username, status FROM users WHERE id = ?",
      authorId
    );

    if (!user) {
      return NextResponse.json(
        { code: 404, msg: "作者不存在" },
        { status: 404 }
      );
    }

    let stories: Record<string, unknown>[] = [];
    let characters: Record<string, unknown>[] = [];
    let worlds: Record<string, unknown>[] = [];
    let totalCount = 0;

    if (!type || type === "story") {
      const result = await db.all(
        `SELECT id, title, summary, tags_json, like_count, favorite_count, view_count,
                publish_at, updated_at, status
         FROM stories
         WHERE author_id = ? AND status = 'published'
         ORDER BY publish_at DESC
         LIMIT ? OFFSET ?`,
        authorId,
        pageSize,
        offset
      );
      stories = result.map((s) => ({
        ...s,
        type: "story",
        tags: s.tags_json ? JSON.parse(s.tags_json as string) : [],
      }));

      const countResult = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM stories WHERE author_id = ? AND status = 'published'",
        authorId
      );
      totalCount += countResult?.count || 0;
    }

    if (!type || type === "character") {
      const result = await db.all(
        `SELECT id, name as title, summary, tags_json, like_count, favorite_count,
                publish_at, updated_at, status, avatar_asset_id
         FROM characters
         WHERE author_id = ? AND status = 'published'
         ORDER BY publish_at DESC
         LIMIT ? OFFSET ?`,
        authorId,
        pageSize,
        offset
      );
      characters = result.map((c) => ({
        ...c,
        type: "character",
        tags: c.tags_json ? JSON.parse(c.tags_json as string) : [],
      }));

      const countResult = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM characters WHERE author_id = ? AND status = 'published'",
        authorId
      );
      totalCount += countResult?.count || 0;
    }

    if (!type || type === "world") {
      const result = await db.all(
        `SELECT id, name as title, summary, tags_json, like_count, favorite_count,
                publish_at, updated_at, status, cover_asset_id
         FROM worlds
         WHERE author_id = ? AND status = 'published'
         ORDER BY publish_at DESC
         LIMIT ? OFFSET ?`,
        authorId,
        pageSize,
        offset
      );
      worlds = result.map((w) => ({
        ...w,
        type: "world",
        tags: w.tags_json ? JSON.parse(w.tags_json as string) : [],
      }));

      const countResult = await db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM worlds WHERE author_id = ? AND status = 'published'",
        authorId
      );
      totalCount += countResult?.count || 0;
    }

    const allWorks = [...stories, ...characters, ...worlds].sort(
      (a, b) => new Date(b.publish_at as string).getTime() - new Date(a.publish_at as string).getTime()
    );

    return NextResponse.json({
      code: 200,
      data: {
        author: {
          id: user.id,
          username: user.status === "deleted" ? "已注销用户" : user.username,
          status: user.status,
        },
        works: type ? allWorks : allWorks.slice(0, pageSize),
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      },
      msg: "获取成功",
    });
  } catch (error) {
    console.error("Get author works error:", error);
    return NextResponse.json(
      { code: 500, msg: "获取失败" },
      { status: 500 }
    );
  }
}
