import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

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

    const { id: storyId } = await params;
    const body = await request.json();

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

    const { features } = body;

    if (!features || typeof features !== "object") {
      return NextResponse.json(
        { code: 400, msg: "无效的文风特征数据" },
        { status: 400 }
      );
    }

    const featuresWithMeta = {
      ...features,
      manuallyUpdated: true,
      updatedAt: nowIso(),
    };

    const existingAnchor = await db.get(
      "SELECT id FROM story_style_anchors WHERE story_id = ? ORDER BY updated_at DESC LIMIT 1",
      storyId
    );

    if (existingAnchor) {
      await db.run(
        "UPDATE story_style_anchors SET features_json = ?, updated_at = ? WHERE id = ?",
        JSON.stringify(featuresWithMeta),
        nowIso(),
        existingAnchor.id
      );

      return NextResponse.json({
        code: 200,
        data: {
          id: existingAnchor.id,
          storyId,
          features: featuresWithMeta,
        },
        msg: "文风锚点更新成功",
      });
    } else {
      const anchorId = Math.random().toString(36).substr(2, 9);
      await db.run(
        "INSERT INTO story_style_anchors (id, story_id, features_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        anchorId,
        storyId,
        JSON.stringify(featuresWithMeta),
        nowIso(),
        nowIso()
      );

      return NextResponse.json({
        code: 200,
        data: {
          id: anchorId,
          storyId,
          features: featuresWithMeta,
        },
        msg: "文风锚点创建成功",
      });
    }
  } catch (error) {
    console.error("Update style anchor error:", error);
    return NextResponse.json(
      { code: 500, msg: "更新失败" },
      { status: 500 }
    );
  }
}
