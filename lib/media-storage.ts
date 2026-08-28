import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function saveRawMediaFile(opts: {
  userId: string;
  assetId: string;
  buffer: Buffer;
  fileName: string;
}): Promise<{ relativePath: string; fileSize: number }> {
  const { userId, assetId, buffer, fileName } = opts;
  const originalDir = path.join(process.cwd(), "storage", "users", userId, "assets", assetId, "original");
  await mkdir(originalDir, { recursive: true });
  const filePath = path.join(originalDir, fileName);
  await writeFile(filePath, buffer);
  const storageRoot = path.join(process.cwd(), "storage");
  return {
    relativePath: path.relative(storageRoot, filePath).replace(/\\/g, "/"),
    fileSize: buffer.byteLength,
  };
}
