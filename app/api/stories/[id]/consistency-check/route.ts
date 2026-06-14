import { getCurrentUserId } from "@/lib/auth";
import { consistencyChecker } from "@/lib/consistency-checker";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const storyId = params_data.id;
  
  // 执行一致性检查
  const violations = await consistencyChecker.checkStory(storyId);
  
  // 统计各类问题
  const stats = {
    total: violations.length,
    errors: violations.filter(v => v.severity === "error").length,
    warnings: violations.filter(v => v.severity === "warning").length,
    info: violations.filter(v => v.severity === "info").length,
  };
  
  return NextResponse.json({
    code: 200,
    data: {
      violations,
      stats,
    },
    msg: `发现 ${violations.length} 个一致性问题`,
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const params_data = await params;
  const storyId = params_data.id;
  
  const { getDb } = await import("@/lib/db");
  const db = await getDb();
  
  // 获取历史检查记录
  const logs = await db.all(
    `SELECT * FROM consistency_check_logs 
     WHERE story_id = ? 
     ORDER BY created_at DESC 
     LIMIT 10`,
    [storyId]
  );
  
  return NextResponse.json({
    code: 200,
    data: logs.map(log => ({
      ...log,
      violations: JSON.parse(log.violations_json || "[]"),
    })),
  });
}
