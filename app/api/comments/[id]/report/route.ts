import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

const reportReasons = [
  "spam",
  "inappropriate",
  "harassment",
  "copyright",
  "other",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { code: 401, msg: "未登录" },
        { status: 401 }
      );
    }

    const { id: commentId } = await params;
    const body = await request.json();

    const { reason, description } = body;

    if (!reason || !reportReasons.includes(reason)) {
      return NextResponse.json(
        { code: 400, msg: "无效的举报原因" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const comment = await db.get<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM comments WHERE id = ?",
      commentId
    );

    if (!comment) {
      return NextResponse.json(
        { code: 404, msg: "评论不存在" },
        { status: 404 }
      );
    }

    if (comment.user_id === userId) {
      return NextResponse.json(
        { code: 400, msg: "不能举报自己的评论" },
        { status: 400 }
      );
    }

    const existingReport = await db.get(
      "SELECT id FROM comment_reports WHERE comment_id = ? AND user_id = ?",
      commentId,
      userId
    );

    if (existingReport) {
      return NextResponse.json(
        { code: 400, msg: "已举报过此评论" },
        { status: 400 }
      );
    }

    await db.run(
      "INSERT INTO comment_reports (id, comment_id, user_id, reason, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      Math.random().toString(36).substr(2, 9),
      commentId,
      userId,
      reason,
      description || "",
      nowIso()
    );

    await db.run(
      "UPDATE comments SET report_count = COALESCE(report_count, 0) + 1 WHERE id = ?",
      commentId
    );

    const reportCount = await db.get<{ report_count: number }>(
      "SELECT report_count FROM comments WHERE id = ?",
      commentId
    );

    if (reportCount && reportCount.report_count >= 5) {
      await db.run(
        "UPDATE comments SET status = 'pending_review' WHERE id = ?",
        commentId
      );
    }

    return NextResponse.json({
      code: 200,
      data: {
        commentId,
        reason,
        description,
        message: "举报已提交，我们会尽快处理",
      },
      msg: "举报成功",
    });
  } catch (error) {
    console.error("Report comment error:", error);
    return NextResponse.json(
      { code: 500, msg: "举报失败" },
      { status: 500 }
    );
  }
}
