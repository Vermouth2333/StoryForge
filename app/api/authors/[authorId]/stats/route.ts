import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ authorId: string }> }
) {
  try {
    const { authorId } = await params;
    const db = await getDb();

    const user = await db.get<{
      id: string;
      username: string;
      email: string;
      status: string;
      created_at: string;
    }>(
      "SELECT id, username, email, status, created_at FROM users WHERE id = ?",
      authorId
    );

    if (!user) {
      return NextResponse.json(
        { code: 404, msg: "作者不存在" },
        { status: 404 }
      );
    }

    const storyStats = await db.get<{
      total_stories: number;
      total_likes: number;
      total_favorites: number;
    }>(
      `SELECT
        COUNT(*) as total_stories,
        COALESCE(SUM(like_count), 0) as total_likes,
        COALESCE(SUM(favorite_count), 0) as total_favorites
       FROM stories
       WHERE author_id = ? AND status = 'published'`,
      authorId
    );

    const characterStats = await db.get<{
      total_characters: number;
      character_likes: number;
    }>(
      `SELECT
        COUNT(*) as total_characters,
        COALESCE(SUM(like_count), 0) as character_likes
       FROM characters
       WHERE author_id = ? AND status = 'published'`,
      authorId
    );

    const worldStats = await db.get<{
      total_worlds: number;
      world_likes: number;
    }>(
      `SELECT
        COUNT(*) as total_worlds,
        COALESCE(SUM(like_count), 0) as world_likes
       FROM worlds
       WHERE author_id = ? AND status = 'published'`,
      authorId
    );

    const followerCount = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM follows WHERE author_id = ?",
      authorId
    );

    const followingCount = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM follows WHERE user_id = ?",
      authorId
    );

    const totalViews = await db.get<{ total: number }>(
      `SELECT COALESCE(SUM(view_count), 0) as total FROM (
        SELECT view_count FROM stories WHERE author_id = ? AND status = 'published'
        UNION ALL
        SELECT view_count FROM characters WHERE author_id = ? AND status = 'published'
        UNION ALL
        SELECT view_count FROM worlds WHERE author_id = ? AND status = 'published'
      )`,
      authorId,
      authorId,
      authorId
    );

    const recentWorks = await db.all(
      `SELECT id, title, 'story' as type, like_count, favorite_count, publish_at
       FROM stories WHERE author_id = ? AND status = 'published'
       ORDER BY publish_at DESC LIMIT 5`,
      authorId
    );

    const totalLikes =
      (storyStats?.total_likes || 0) +
      (characterStats?.character_likes || 0) +
      (worldStats?.world_likes || 0);

    return NextResponse.json({
      code: 200,
      data: {
        author: {
          id: user.id,
          username: user.status === "deleted" ? "已注销用户" : user.username,
          status: user.status,
          createdAt: user.created_at,
        },
        stats: {
          totalWorks:
            (storyStats?.total_stories || 0) +
            (characterStats?.total_characters || 0) +
            (worldStats?.total_worlds || 0),
          stories: {
            count: storyStats?.total_stories || 0,
            likes: storyStats?.total_likes || 0,
            favorites: storyStats?.total_favorites || 0,
          },
          characters: {
            count: characterStats?.total_characters || 0,
            likes: characterStats?.character_likes || 0,
          },
          worlds: {
            count: worldStats?.total_worlds || 0,
            likes: worldStats?.world_likes || 0,
          },
          followers: followerCount?.count || 0,
          following: followingCount?.count || 0,
          totalLikes,
          totalViews: totalViews?.total || 0,
        },
        recentWorks,
      },
      msg: "获取成功",
    });
  } catch (error) {
    console.error("Get author stats error:", error);
    return NextResponse.json(
      { code: 500, msg: "获取失败" },
      { status: 500 }
    );
  }
}
