import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: worldId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const db = await getDb();
  const world = await db.get<{ id: string; author_id: string }>(
    "SELECT id, author_id FROM worlds WHERE id = ?",
    worldId,
  );
  if (!world) {
    return NextResponse.json({ code: 404, msg: "世界卡不存在" }, { status: 404 });
  }
  if (world.author_id !== userId) {
    return NextResponse.json({ code: 403, msg: "无权操作" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ code: 400, msg: "没有上传文件" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ code: 400, msg: "文件大小超过 10MB 限制" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ code: 400, msg: "仅支持 JPG/PNG/WebP 格式" }, { status: 400 });
  }

  const assetId = id("asset");
  const ext = file.name.split(".").pop() || "jpg";
  const baseDir = path.join(process.cwd(), "storage", "users", userId, "assets", assetId);
  const originalDir = path.join(baseDir, "original");
  const thumbnailDir = path.join(baseDir, "thumbnails");
  await mkdir(originalDir, { recursive: true });
  await mkdir(thumbnailDir, { recursive: true });

  const fileName = `cover_${assetId}.${ext}`;
  const originalPath = path.join(originalDir, fileName);
  const thumbnailPath = path.join(thumbnailDir, "thumb_200x200.jpg");

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(originalPath, buffer);

  try {
    await sharp(buffer)
      .resize(200, 200, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toFile(thumbnailPath);
  } catch (e) {
    console.error("封面缩略图生成失败:", e);
  }

  const relativePath = path.relative(path.join(process.cwd(), "storage"), originalPath).replace(/\\/g, "/");
  const relativeThumbPath = path.relative(path.join(process.cwd(), "storage"), thumbnailPath).replace(/\\/g, "/");
  const now = nowIso();

  await db.run(
    `INSERT INTO assets (id, user_id, asset_type, target_type, target_id, file_name, file_path, thumbnail_path, file_size_bytes, mime_type, created_at)
     VALUES (?, ?, 'cover', 'world', ?, ?, ?, ?, ?, ?, ?)`,
    assetId, userId, worldId, file.name, relativePath, relativeThumbPath, file.size, file.type, now,
  );

  await db.run(
    "UPDATE worlds SET cover_asset_id = ?, updated_at = ? WHERE id = ?",
    assetId, now, worldId,
  );

  return NextResponse.json({
    code: 200,
    msg: "封面上传成功",
    data: {
      asset_id: assetId,
      cover_url: `/api/assets/${assetId}/file`,
      thumbnail_url: `/api/assets/${assetId}/thumbnail`,
    },
  });
}
