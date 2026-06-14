import { getDb, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { styleAnchor, StyleFeatures } from "@/lib/style-anchor";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const params_data = await params;
  const storyId = params_data.id;
  
  const features = await styleAnchor.getStyleAnchor(storyId);
  
  if (!features) {
    return NextResponse.json({ 
      code: 404,
      msg: "暂无文风锚点",
      data: null 
    });
  }
  
  return NextResponse.json({
    code: 200,
    data: features
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const storyId = params_data.id;
  
  // 验证用户是否是故事作者
  const db = await getDb();
  const story = await db.get("SELECT * FROM stories WHERE id = ? AND author_id = ?", [storyId, userId]);
  
  if (!story) {
    return NextResponse.json({ error: "故事不存在或无权操作" }, { status: 404 });
  }
  
  const body = await request.json();
  const { messages } = body; // 最近的消息历史
  
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "缺少消息历史" }, { status: 400 });
  }
  
  // 抽取文风特征
  const features = await styleAnchor.extractStyle(storyId, messages);
  
  return NextResponse.json({
    code: 200,
    data: features,
    msg: "文风锚点已更新"
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const params_data = await params;
  const storyId = params_data.id;
  
  const db = await getDb();
  
  // 验证用户是否是故事作者
  const story = await db.get("SELECT * FROM stories WHERE id = ? AND author_id = ?", [storyId, userId]);
  
  if (!story) {
    return NextResponse.json({ error: "故事不存在或无权操作" }, { status: 404 });
  }
  
  // 删除文风锚点
  await db.run("DELETE FROM story_style_anchors WHERE story_id = ?", [storyId]);
  
  return NextResponse.json({
    code: 200,
    msg: "文风锚点已删除"
  });
}
