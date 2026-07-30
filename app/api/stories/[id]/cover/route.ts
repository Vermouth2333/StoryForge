import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import {
  COVER_ALLOWED_TYPES,
  COVER_MAX_UPLOAD_BYTES,
  processAndSaveCover,
} from "@/lib/cover-processing";
import { getDb, id, nowIso } from "@/lib/db";
import { invalidateMarketCache } from "@/lib/invalidate-market-cache";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const db = await getDb();
  const story = await db.get<{ id: string; author_id: string; status: string }>(
    "SELECT id, author_id, status FROM stories WHERE id = ?",
    storyId,
  );
  if (!story) {
    return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
  }
  if (story.author_id !== userId) {
    return NextResponse.json({ code: 403, msg: "无权操作" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ code: 400, msg: "没有上传文件" }, { status: 400 });
  }
  if (file.size > COVER_MAX_UPLOAD_BYTES) {
    return NextResponse.json({ code: 400, msg: "文件大小超过 10MB 限制" }, { status: 400 });
  }
  if (!(COVER_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ code: 400, msg: "仅支持 JPG/PNG/WebP 格式" }, { status: 400 });
  }

  const assetId = id("asset");
  const buffer = Buffer.from(await file.arrayBuffer());
  let processed;
  try {
    processed = await processAndSaveCover({ userId, assetId, input: buffer });
  } catch (e) {
    console.error("封面处理失败:", e);
    return NextResponse.json({ code: 400, msg: "封面图片无法处理，请换一张图重试" }, { status: 400 });
  }

  const now = nowIso();

  await db.run(
    `INSERT INTO assets (id, user_id, asset_type, target_type, target_id, file_name, file_path, thumbnail_path, file_size_bytes, mime_type, created_at)
     VALUES (?, ?, 'cover', 'story', ?, ?, ?, ?, ?, ?, ?)`,
    assetId,
    userId,
    storyId,
    processed.fileName,
    processed.relativePath,
    processed.relativeThumbPath,
    processed.fileSize,
    processed.mimeType,
    now,
  );

  await db.run(
    "UPDATE stories SET cover_asset_id = ?, updated_at = ? WHERE id = ?",
    assetId,
    now,
    storyId,
  );

  if (story.status === "published") {
    await invalidateMarketCache();
  }

  return NextResponse.json({
    code: 200,
    msg: "封面上传成功",
    data: {
      asset_id: assetId,
      cover_url: `/api/assets/${assetId}/file`,
      thumbnail_url: `/api/assets/${assetId}/thumbnail`,
      width: processed.width,
      height: processed.height,
      mime_type: processed.mimeType,
    },
  });
}
