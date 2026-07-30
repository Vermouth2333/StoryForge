import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

/** 封面主图目标宽度（保持原图比例） */
export const COVER_TARGET_WIDTH = 740;
export const COVER_MIME = "image/webp" as const;
export const COVER_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const COVER_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ProcessedCover = {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: typeof COVER_MIME;
  fileName: string;
  fileSize: number;
  relativePath: string;
  relativeThumbPath: string;
};

/**
 * 将上传封面转为 WebP：宽约 740（不放大），高度按原比例。
 * 同时生成 200×200 缩略图并写入 storage。
 */
export async function processAndSaveCover(opts: {
  userId: string;
  assetId: string;
  input: Buffer;
}): Promise<ProcessedCover> {
  const { userId, assetId, input } = opts;

  const resized = sharp(input).resize({
    width: COVER_TARGET_WIDTH,
    withoutEnlargement: true,
    fit: "inside",
  });

  const webpBuffer = await resized.webp({ quality: 82, effort: 4 }).toBuffer();
  const meta = await sharp(webpBuffer).metadata();

  const baseDir = path.join(process.cwd(), "storage", "users", userId, "assets", assetId);
  const originalDir = path.join(baseDir, "original");
  const thumbnailDir = path.join(baseDir, "thumbnails");
  await mkdir(originalDir, { recursive: true });
  await mkdir(thumbnailDir, { recursive: true });

  const fileName = `cover_${assetId}.webp`;
  const originalPath = path.join(originalDir, fileName);
  const thumbnailPath = path.join(thumbnailDir, "thumb_200x200.jpg");

  await writeFile(originalPath, webpBuffer);

  try {
    await sharp(webpBuffer)
      .resize(200, 200, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toFile(thumbnailPath);
  } catch (e) {
    console.error("封面缩略图生成失败:", e);
  }

  const storageRoot = path.join(process.cwd(), "storage");
  const relativePath = path.relative(storageRoot, originalPath).replace(/\\/g, "/");
  const relativeThumbPath = path.relative(storageRoot, thumbnailPath).replace(/\\/g, "/");

  return {
    buffer: webpBuffer,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    mimeType: COVER_MIME,
    fileName,
    fileSize: webpBuffer.byteLength,
    relativePath,
    relativeThumbPath,
  };
}
