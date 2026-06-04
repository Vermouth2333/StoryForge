import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
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

    const { id: storyId } = await params;
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Number(url.searchParams.get("page_size") || "20"));
    const offset = (page - 1) * pageSize;
    const level = url.searchParams.get("level");

    const db = await getDb();

    const story = await db.get<{ id: string; author_id: string }>(
      "SELECT id, author_id FROM stories WHERE id = ?",
      storyId
    );

    if (!story) {
      return NextResponse.json(
        { code: 404, msg: "故事不存在" },
        { status: 404 }
      );
    }

    if (story.author_id !== userId) {
      return NextResponse.json(
        { code: 403, msg: "无权限" },
        { status: 403 }
      );
    }

    let whereClause = "story_id = ?";
    const params2: (string | number)[] = [storyId];

    if (level && ["P0", "P1", "P2"].includes(level)) {
      whereClause += " AND conflict_level = ?";
      params2.push(level);
    }

    const logs = await db.all(
      `SELECT id, character_id, world_id, content, conflict_level,
              conflict_details_json, created_at
       FROM conflict_detection_logs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      ...params2,
      pageSize,
      offset
    );

    const countResult = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM conflict_detection_logs WHERE ${whereClause}`,
      ...params2
    );

    const formattedLogs = logs.map((log) => {
      let details: Record<string, unknown> = {};
      try {
        details = log.conflict_details_json
          ? JSON.parse(log.conflict_details_json as string)
          : {};
      } catch {}

      return {
        id: log.id,
        characterId: log.character_id,
        worldId: log.world_id,
        content: log.content,
        level: log.conflict_level,
        details: {
          conflictPoint: details.conflictPoint || "",
          reason: details.reason || "",
          rewriteSuggestions: details.rewriteSuggestions || [],
          rewrittenInstruction: details.rewrittenInstruction || "",
        },
        createdAt: log.created_at,
      };
    });

    return NextResponse.json({
      code: 200,
      data: {
        storyId,
        logs: formattedLogs,
        pagination: {
          page,
          pageSize,
          totalCount: countResult?.count || 0,
          totalPages: Math.ceil((countResult?.count || 0) / pageSize),
        },
        summary: {
          total: countResult?.count || 0,
          P0: await db.get<{ count: number }>(
            "SELECT COUNT(*) as count FROM conflict_detection_logs WHERE story_id = ? AND conflict_level = 'P0'",
            storyId
          ),
          P1: await db.get<{ count: number }>(
            "SELECT COUNT(*) as count FROM conflict_detection_logs WHERE story_id = ? AND conflict_level = 'P1'",
            storyId
          ),
          P2: await db.get<{ count: number }>(
            "SELECT COUNT(*) as count FROM conflict_detection_logs WHERE story_id = ? AND conflict_level = 'P2'",
            storyId
          ),
        },
      },
      msg: "获取成功",
    });
  } catch (error) {
    console.error("Get conflict logs error:", error);
    return NextResponse.json(
      { code: 500, msg: "获取失败" },
      { status: 500 }
    );
  }
}
