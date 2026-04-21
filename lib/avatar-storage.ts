import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024;
const STORAGE = path.join(process.cwd(), "storage", "users");

export function assertSafeUserIdForPath(userId: string): void {
  if (!/^[\w.-]+$/.test(userId) || userId.length > 200) {
    throw new Error("INVALID_USER_ID");
  }
}

export function detectJpegOrPng(buffer: Buffer): "jpeg" | "png" | null {
  if (buffer.length < 8) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  return null;
}

/** 写入文档约定目录：original / thumb_200x200；返回可供写入 DB 的公开 URL（带 cache bust） */
export async function persistUserAvatar(
  userId: string,
  buffer: Buffer,
): Promise<{ avatarUrl: string }> {
  assertSafeUserIdForPath(userId);

  const kind = detectJpegOrPng(buffer);
  if (!kind) {
    throw new Error("UNSUPPORTED_IMAGE");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const rand = crypto.randomBytes(3).toString("hex");
  const stamp = Date.now();
  const baseDir = path.join(STORAGE, userId, "avatar");
  const origDir = path.join(baseDir, "original");
  const thumbDir = path.join(baseDir, "thumb_200x200");
  await fs.mkdir(origDir, { recursive: true });
  await fs.mkdir(thumbDir, { recursive: true });

  const origName = `avatar_${stamp}_${rand}.${kind === "png" ? "png" : "jpg"}`;
  const originalPath = path.join(origDir, origName);
  await fs.writeFile(originalPath, buffer);

  const thumbPath = path.join(thumbDir, "thumb.jpg");
  await sharp(buffer)
    .rotate()
    .resize(200, 200, { fit: "cover", position: "attention" })
    .jpeg({ quality: 85 })
    .toFile(thumbPath);

  const bust = `${stamp}_${rand}`;
  const avatarUrl = `/api/media/user-avatar/${encodeURIComponent(userId)}?v=${bust}`;
  return { avatarUrl };
}

export function userAvatarThumbPath(userId: string): string {
  assertSafeUserIdForPath(userId);
  return path.join(STORAGE, userId, "avatar", "thumb_200x200", "thumb.jpg");
}
