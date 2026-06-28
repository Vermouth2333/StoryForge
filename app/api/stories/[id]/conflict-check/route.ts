import { getCurrentUserId } from "@/lib/auth";
import { conflictDetector } from "@/lib/conflict-detector";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const params_data = await params;
  const storyId = params_data.id;

  // 稳健解析 body：空 body / 非 JSON 均降级为空对象
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    body = {};
  }
  const content = typeof body.content === "string" ? body.content : "";
  const characterIdsRaw = body.character_ids;
  const character_ids = Array.isArray(characterIdsRaw)
    ? characterIdsRaw.filter((x): x is string => typeof x === "string")
    : [];

  const { getDb } = await import("@/lib/db");
  const db = await getDb();

  // 获取故事信息（stories 表无 world_id，需从 story_worlds 关联表查询）
  const story = await db.get<{
    id: string;
    title: string;
    summary: string;
  }>("SELECT id, title, summary FROM stories WHERE id = ?", [storyId]);

  if (!story) {
    return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
  }

  // 查询故事关联的世界（取第一个用于冲突检测）
  const worldRow = await db.get<{ world_id: string }>(
    "SELECT world_id FROM story_worlds WHERE story_id = ? LIMIT 1",
    [storyId],
  );
  const worldId = worldRow?.world_id ?? null;

  // 若未传入 content，则聚合故事大纲节点内容作为检测文本
  let detectContent = content.trim();
  if (!detectContent) {
    const nodes: any = await db.all<{ title: string; content: string }>(
      "SELECT title, content FROM story_outline_nodes WHERE story_id = ? ORDER BY sort_order ASC",
      [storyId],
    );
    const parts: string[] = [];
    if (story.summary) parts.push(story.summary);
    for (const n of nodes || []) {
      if (n.title) parts.push(n.title);
      if (n.content) parts.push(n.content);
    }
    detectContent = parts.join("\n").trim();
  }
  if (!detectContent) {
    return NextResponse.json({
      code: 200,
      data: { conflicts: [], total: 0, has_critical: false, has_warnings: false },
      msg: "故事尚无内容可检测，请先填写大纲或故事简介",
    });
  }

  // 获取故事关联的角色 ID
  let charIds = character_ids;
  if (charIds.length === 0) {
    const relChars: any = await db.all<{ character_id: string }>(
      "SELECT character_id FROM story_characters WHERE story_id = ?",
      [storyId],
    );
    charIds = (relChars || []).map((r: any) => r.character_id);
  }

  // 检测冲突（detect 内部会统一写入日志，包含 story_id）
  const conflicts = await conflictDetector.detect(
    detectContent,
    worldId,
    charIds,
    storyId,
  );

  return NextResponse.json({
    code: 200,
    data: {
      conflicts,
      total: conflicts.length,
      has_critical: conflicts.some((c) => c.level === "P0"),
      has_warnings: conflicts.some((c) => c.level === "P1"),
    },
    msg: `检测到 ${conflicts.length} 个潜在冲突`,
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const params_data = await params;
  const storyId = params_data.id;

  const { getDb } = await import("@/lib/db");
  const db = await getDb();

  const logs = await db.all<{
    id: string;
    story_id: string | null;
    world_id: string | null;
    content: string | null;
    conflict_level: string | null;
    conflict_details_json: string | null;
    created_at: string;
  }>(
    `SELECT id, story_id, world_id, content, conflict_level, conflict_details_json, created_at
     FROM conflict_detection_logs
     WHERE story_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [storyId],
  );

  return NextResponse.json({
    code: 200,
    data: (Array.isArray(logs) ? logs : []).map((log) => {
      let details: Record<string, unknown> = {};
      try {
        details = JSON.parse(log.conflict_details_json || "{}");
      } catch {
        details = {};
      }
      return {
        id: log.id,
        story_id: log.story_id,
        world_id: log.world_id,
        content: log.content,
        conflict_level: log.conflict_level,
        created_at: log.created_at,
        conflict_details: details,
      };
    }),
  });
}
