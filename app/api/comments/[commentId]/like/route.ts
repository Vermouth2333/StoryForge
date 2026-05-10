import { getDb, id, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, props: { params: Promise<{ commentId: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const db = await getDb();
  const { commentId } = params;
  
  // 检查是否已点赞
  const existingLike = await db.get(
    "SELECT * FROM comment_likes WHERE user_id = ? AND comment_id = ?",
    [userId, commentId]
  );
  
  if (existingLike) {
    // 取消点赞
    await db.run("DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?", [userId, commentId]);
    await db.run("UPDATE comments SET like_count = like_count - 1 WHERE id = ?", [commentId]);
    return NextResponse.json({ liked: false });
  } else {
    // 点赞
    const likeId = id("commentlike");
    await db.run(
      "INSERT INTO comment_likes (id, user_id, comment_id, created_at) VALUES (?, ?, ?, ?)",
      [likeId, userId, commentId, nowIso()]
    );
    await db.run("UPDATE comments SET like_count = like_count + 1 WHERE id = ?", [commentId]);
    return NextResponse.json({ liked: true });
  }
}
