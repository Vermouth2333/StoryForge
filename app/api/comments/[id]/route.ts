import { getDb, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const db = await getDb();
  const body = await request.json();
  const { content } = body;
  const commentId = params.id;
  
  const comment = await db.get("SELECT * FROM comments WHERE id = ?", [commentId]);
  if (!comment) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }
  
  if (comment.user_id !== userId) {
    return NextResponse.json({ error: "只能编辑自己的评论" }, { status: 403 });
  }
  
  await db.run(
    "UPDATE comments SET content = ?, updated_at = ? WHERE id = ?",
    [content, nowIso(), commentId]
  );
  
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const db = await getDb();
  const commentId = params.id;
  
  const comment = await db.get("SELECT * FROM comments WHERE id = ?", [commentId]);
  if (!comment) {
    return NextResponse.json({ error: "评论不存在" }, { status: 404 });
  }
  
  if (comment.user_id !== userId) {
    return NextResponse.json({ error: "只能删除自己的评论" }, { status: 403 });
  }
  
  // 减少父评论的回复数
  if (comment.parent_comment_id) {
    await db.run(
      "UPDATE comments SET reply_count = reply_count - 1 WHERE id = ?",
      [comment.parent_comment_id]
    );
  }
  
  // 删除评论的点赞
  await db.run("DELETE FROM comment_likes WHERE comment_id = ?", [commentId]);
  // 删除评论的回复
  await db.run("DELETE FROM comments WHERE parent_comment_id = ?", [commentId]);
  // 删除评论
  await db.run("DELETE FROM comments WHERE id = ?", [commentId]);
  
  return NextResponse.json({ success: true });
}
