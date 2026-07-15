import { readFile } from "fs/promises";
import path from "path";
import { getDb } from "@/lib/db";

type AssetRow = {
  file_path: string;
  thumbnail_path: string | null;
  mime_type: string;
};

export async function serveAssetFile(assetId: string, variant: "file" | "thumbnail") {
  const db = await getDb();
  const asset = await db.get<AssetRow>(
    "SELECT file_path, thumbnail_path, mime_type FROM assets WHERE id = ?",
    assetId,
  );
  if (!asset) {
    return null;
  }

  const rel =
    variant === "thumbnail" && asset.thumbnail_path ? asset.thumbnail_path : asset.file_path;
  const filePath = path.join(process.cwd(), "storage", rel);

  try {
    const fileBuffer = await readFile(filePath);
    const contentType = variant === "thumbnail" ? "image/jpeg" : asset.mime_type;
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("资源文件读取失败:", error);
    return null;
  }
}
