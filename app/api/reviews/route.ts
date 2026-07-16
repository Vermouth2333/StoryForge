import { getDb, id, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  
  const db = await getDb();
  const body = await request.json();
  const { target_type, target_id, rating, content } = body;
  
  if (!target_type || !target_id || !rating) {
    return NextResponse.json({ code: 400, msg: "参数不完整" }, { status: 400 });
  }
  
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ code: 400, msg: "评分必须在 1-5 之间" }, { status: 400 });
  }
  
  // 检查是否已评分
  const existingReview = await db.get<{ id: string }>(
    "SELECT id FROM reviews WHERE user_id = ? AND target_type = ? AND target_id = ?",
    [userId, target_type, target_id]
  );
  
  const now = nowIso();
  
  if (existingReview) {
    await db.run(
      "UPDATE reviews SET rating = ?, content = ?, updated_at = ? WHERE id = ?",
      [rating, content || null, now, existingReview.id]
    );
    return NextResponse.json({
      code: 200,
      data: { id: existingReview.id, updated: true },
      msg: "评价已更新",
    });
  }

  const reviewId = id("review");
  await db.run(
    "INSERT INTO reviews (id, user_id, target_type, target_id, rating, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [reviewId, userId, target_type, target_id, rating, content || null, now, now]
  );
  return NextResponse.json({
    code: 200,
    data: { id: reviewId, updated: false },
    msg: "评价已提交",
  });
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
  
  // 获取平均分
  const stats = await db.get(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as total_count 
     FROM reviews 
     WHERE target_type = ? AND target_id = ?`,
    [target_type, target_id]
  );
  
  // 获取评分列表（更新后按最近活动时间排序）
  const reviews = await db.all(
    `SELECT r.*, u.username, u.avatar_url 
     FROM reviews r 
     JOIN users u ON r.user_id = u.id 
     WHERE r.target_type = ? AND r.target_id = ? 
     ORDER BY datetime(r.updated_at) DESC, datetime(r.created_at) DESC 
     LIMIT ? OFFSET ?`,
    [target_type, target_id, pageSize, (page - 1) * pageSize]
  );
  
  // 获取当前用户的评分（如果已登录）
  const userId = await getCurrentUserId();
  let userReview = null;
  
  if (userId) {
    userReview = await db.get(
      "SELECT * FROM reviews WHERE user_id = ? AND target_type = ? AND target_id = ?",
      [userId, target_type, target_id]
    );
  }
  
  return NextResponse.json({
    stats: {
      avg_rating: Number(stats?.avg_rating) || 0,
      total_count: Number(stats?.total_count) || 0,
    },
    reviews,
    user_review: userReview,
    page,
    pageSize,
  });
}
