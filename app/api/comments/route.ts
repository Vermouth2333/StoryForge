import { getDb, id, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const db = await getDb();
  const body = await request.json();
  const { target_type, target_id, content, parent_comment_id } = body;
  
  if (!target_type || !target_id || !content) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  
  const commentId = id("comment");
  const now = nowIso();
  
  await db.run(
    `INSERT INTO comments (id, user_id, target_type, target_id, parent_comment_id, content, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [commentId, userId, target_type, target_id, parent_comment_id || null, content, now, now]
  );
  
  // 增加父评论的回复数
  if (parent_comment_id) {
    await db.run(
      `UPDATE comments SET reply_count = reply_count + 1 WHERE id = ?`,
      [parent_comment_id]
    );
  }
  
  return NextResponse.json({ id: commentId });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const target_type = searchParams.get("target_type");
  const target_id = searchParams.get("target_id");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = 20;
  
  if (!target_type || !target_id) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  
  const db = await getDb();
  
  // 获取一级评论
  const comments = await db.all(
    `SELECT c.*, u.username, u.avatar_url 
     FROM comments c 
     JOIN users u ON c.user_id = u.id 
     WHERE c.target_type = ? AND c.target_id = ? AND c.parent_comment_id IS NULL 
     ORDER BY c.created_at DESC 
     LIMIT ? OFFSET ?`,
    [target_type, target_id, pageSize, (page - 1) * pageSize]
  );
  
  // 获取评论的点赞状态（如果已登录）
  const userId = await getCurrentUserId();
  let likedCommentIds = new Set<string>();
  
  if (userId && comments.length > 0) {
    const placeholders = comments.map(() => "?").join(",");
    const likes = await db.all(
      `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders})`,
      [userId, ...comments.map(c => c.id)]
    );
    likedCommentIds = new Set(likes.map(l => l.comment_id));
  }
  
  // 获取回复（二级评论）
  const replyPromises = comments.map(comment => {
    return db.all(
      `SELECT c.*, u.username, u.avatar_url 
       FROM comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.parent_comment_id = ? 
       ORDER BY c.created_at ASC`,
      [comment.id]
    );
  });
  
  const allReplies = await Promise.all(replyPromises);
  const commentMap = new Map(comments.map((c, i) => [c.id, { ...c, replies: allReplies[i], liked: likedCommentIds.has(c.id) }]));
  
  return NextResponse.json({ comments: Array.from(commentMap.values()), page, pageSize });
}
