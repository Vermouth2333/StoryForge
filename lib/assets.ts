import { getDb, nowIso } from "./db";
import fs from "fs";
import path from "path";

export interface UploadAssetResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
}

export interface UploadOptions {
  type?: "cover" | "illustration" | "avatar" | "other";
  referenceId?: string;
}

export async function uploadAsset(
  file: File,
  userId: string,
  options: UploadOptions = {}
): Promise<UploadAssetResult> {
  const assetId = Math.random().toString(36).substr(2, 9);
  const assetType = options.type || "other";
  const referenceId = options.referenceId;

  const userDir = path.join(process.cwd(), "public", "assets", userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const fileExtension = file.name.split(".").pop() || "png";
  const filename = `${assetId}.${fileExtension}`;
  const filePath = path.join(userDir, filename);

  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

  const url = `/assets/${userId}/${filename}`;

  const db = await getDb();
  await db.run(
    "INSERT INTO assets (id, user_id, filename, asset_type, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    assetId,
    userId,
    filename,
    assetType,
    referenceId,
    nowIso()
  );

  return {
    id: assetId,
    url,
  };
}

export async function getAssetUrl(assetId: string): Promise<string | null> {
  const db = await getDb();
  const asset = await db.get(
    "SELECT user_id, filename FROM assets WHERE id = ?",
    assetId
  );

  if (!asset) {
    return null;
  }

  return `/assets/${asset.user_id}/${asset.filename}`;
}

export async function deleteAsset(assetId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const asset = await db.get(
    "SELECT user_id, filename FROM assets WHERE id = ?",
    assetId
  );

  if (!asset || asset.user_id !== userId) {
    return false;
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "assets",
    asset.user_id,
    asset.filename
  );

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await db.run("DELETE FROM assets WHERE id = ?", assetId);

  return true;
}
