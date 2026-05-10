import { getCurrentUserId } from "@/lib/auth";
import { conflictDetector } from "@/lib/conflict-detector";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const { storyId } = params_data;
  const body = await request.json();
  const { content, character_ids } = body;
  
  if (!content) {
    return NextResponse.json({ error: "缺少检测内容" }, { status: 400 });
  }
  
  // 检测冲突
  const conflicts = await conflictDetector.detect(
    content,
    null, // worldId 从故事中获取
    character_ids || []
  );
  
  return NextResponse.json({
    code: 200,
    data: {
      conflicts,
      total: conflicts.length,
      has_critical: conflicts.some(c => c.level === "P0"),
      has_warnings: conflicts.some(c => c.level === "P1"),
    },
    msg: `检测到 ${conflicts.length} 个潜在冲突`
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const params_data = await params;
  const { storyId } = params_data;
  
  // 获取该故事的冲突历史
  const { getDb } = await import("@/lib/db");
  const db = await getDb();
  
  const logs = await db.all(
    `SELECT * FROM conflict_detection_logs 
     WHERE story_id = ? 
     ORDER BY created_at DESC 
     LIMIT 50`,
    [storyId]
  );
  
  return NextResponse.json({
    code: 200,
    data: logs.map(log => ({
      ...log,
      conflict_details: JSON.parse(log.conflict_details_json || "{}"),
    })),
  });
}
