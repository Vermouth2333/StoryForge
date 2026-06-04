import { getDb, id, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const db = await getDb();
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const assetType = formData.get("asset_type") as string || "other"; // cover/illustration/other
  const targetType = formData.get("target_type") as string | null; // story/character/world/chapter
  const targetId = formData.get("target_id") as string | null;

  if (!file) {
    return NextResponse.json({ error: "没有上传文件" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "文件大小超过 10MB 限制" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
  }

  const assetId = id("asset");
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${assetId}.${ext}`;
  
  // 存储路径：storage/users/{userId}/assets/{assetId}/
  const baseDir = path.join(process.cwd(), "storage", "users", userId, "assets", assetId);
  const originalDir = path.join(baseDir, "original");
  const thumbnailDir = path.join(baseDir, "thumbnails");
  
  await mkdir(originalDir, { recursive: true });
  await mkdir(thumbnailDir, { recursive: true });
  
  const originalPath = path.join(originalDir, fileName);
  const thumbnailPath = path.join(thumbnailDir, `thumb_200x200.jpg`);
  
  // 读取并保存原始文件
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(originalPath, buffer);
  
  // 生成缩略图
  try {
    await sharp(buffer)
      .resize(200, 200, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toFile(thumbnailPath);
  } catch (error) {
    console.error("缩略图生成失败:", error);
  }
  
  // 计算相对路径
  const relativePath = path.relative(path.join(process.cwd(), "storage"), originalPath).replace(/\\/g, "/");
  const relativeThumbPath = path.relative(path.join(process.cwd(), "storage"), thumbnailPath).replace(/\\/g, "/");
  
  const now = nowIso();
  
  // 保存到数据库
  await db.run(
    `INSERT INTO assets (id, user_id, asset_type, target_type, target_id, file_name, file_path, thumbnail_path, file_size_bytes, mime_type, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [assetId, userId, assetType, targetType, targetId, file.name, relativePath, relativeThumbPath, file.size, file.type, now]
  );
  
  return NextResponse.json({
    id: assetId,
    file_name: file.name,
    file_path: `/api/assets/${assetId}/file`,
    thumbnail_path: `/api/assets/${assetId}/thumbnail`,
    created_at: now,
  });
}

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const targetType = searchParams.get("target_type");
  const targetId = searchParams.get("target_id");
  const assetType = searchParams.get("asset_type");
  
  const db = await getDb();
  
  let query = "SELECT * FROM assets WHERE user_id = ?";
  const params: (string | number)[] = [userId];
  
  if (targetType && targetId) {
    query += " AND target_type = ? AND target_id = ?";
    params.push(targetType, targetId);
  }
  
  if (assetType) {
    query += " AND asset_type = ?";
    params.push(assetType);
  }
  
  query += " ORDER BY created_at DESC";
  
  const assets = await db.all(query, params);
  
  return NextResponse.json({ assets });
}
