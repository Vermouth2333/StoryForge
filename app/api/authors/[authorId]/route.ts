import { getDb } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, props: { params: Promise<{ authorId: string }> }) {
  const params = await props.params;
  const { authorId } = params;
  const db = await getDb();
  
  // 获取作者信息
  const user = await db.get(
    "SELECT id, username, avatar_url, bio, created_at FROM users WHERE id = ?",
    [authorId]
  );
  
  if (!user) {
    return NextResponse.json({ error: "作者不存在" }, { status: 404 });
  }
  
  // 统计数据
  const storyStats = await db.get(
    "SELECT COUNT(*) as count, SUM(like_count) as total_likes FROM stories WHERE author_id = ? AND status = 'published'",
    [authorId]
  );
  
  const characterStats = await db.get(
    "SELECT COUNT(*) as count, SUM(like_count) as total_likes FROM characters WHERE author_id = ? AND status = 'published'",
    [authorId]
  );
  
  const worldStats = await db.get(
    "SELECT COUNT(*) as count, SUM(like_count) as total_likes FROM worlds WHERE author_id = ? AND status = 'published'",
    [authorId]
  );
  
  const followers = await db.get(
    "SELECT COUNT(*) as count FROM follows WHERE author_id = ?",
    [authorId]
  );
  
  // 获取当前用户是否关注此作者
  const currentUserId = await getCurrentUserId();
  let isFollowing = false;
  
  if (currentUserId) {
    const follow = await db.get(
      "SELECT * FROM follows WHERE user_id = ? AND author_id = ?",
      [currentUserId, authorId]
    );
    isFollowing = !!follow;
  }
  
  // 获取作品列表
  const stories = await db.all(
    "SELECT * FROM stories WHERE author_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 10",
    [authorId]
  );
  
  const characters = await db.all(
    "SELECT * FROM characters WHERE author_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 10",
    [authorId]
  );
  
  const worlds = await db.all(
    "SELECT * FROM worlds WHERE author_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 10",
    [authorId]
  );
  
  return NextResponse.json({
    author: user,
    stats: {
      stories: { count: storyStats?.count || 0, total_likes: storyStats?.total_likes || 0 },
      characters: { count: characterStats?.count || 0, total_likes: characterStats?.total_likes || 0 },
      worlds: { count: worldStats?.count || 0, total_likes: worldStats?.total_likes || 0 },
      followers: followers?.count || 0
    },
    is_following: isFollowing,
    is_self: currentUserId === authorId,
    works: { stories, characters, worlds }
  });
}
