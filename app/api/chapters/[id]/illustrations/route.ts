import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { uploadAsset } from "@/lib/assets";

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

    const { id: chapterId } = await params;

    const db = await getDb();

    const chapter = await db.get<{ id: string; story_id: string }>(
      "SELECT id, story_id FROM chapters WHERE id = ?",
      chapterId
    );

    if (!chapter) {
      return NextResponse.json(
        { code: 404, msg: "章节不存在" },
        { status: 404 }
      );
    }

    const story = await db.get<{ author_id: string }>(
      "SELECT author_id FROM stories WHERE id = ?",
      chapter.story_id
    );

    if (!story || story.author_id !== userId) {
      return NextResponse.json(
        { code: 403, msg: "无权限" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { code: 400, msg: "请上传文件" },
        { status: 400 }
      );
    }

    const asset = await uploadAsset(file, userId, {
      type: "illustration",
      referenceId: chapterId,
    });

    const existingIllustration = await db.get(
      "SELECT id FROM chapter_illustrations WHERE chapter_id = ?",
      chapterId
    );

    if (existingIllustration) {
      await db.run(
        "UPDATE chapter_illustrations SET asset_id = ?, updated_at = ? WHERE id = ?",
        asset.id,
        nowIso(),
        existingIllustration.id
      );
    } else {
      await db.run(
        "INSERT INTO chapter_illustrations (id, chapter_id, asset_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        Math.random().toString(36).substr(2, 9),
        chapterId,
        asset.id,
        nowIso(),
        nowIso()
      );
    }

    return NextResponse.json({
      code: 200,
      data: {
        chapterId,
        assetId: asset.id,
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl,
      },
      msg: "插图上传成功",
    });
  } catch (error) {
    console.error("Upload illustration error:", error);
    return NextResponse.json(
      { code: 500, msg: "上传失败" },
      { status: 500 }
    );
  }
}
