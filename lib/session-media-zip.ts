import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import type { Database } from "sqlite";

export type SessionMediaKind = "image" | "video";

function resolveUnderStorage(rel: string): string | null {
  const storageRoot = path.resolve(process.cwd(), "storage");
  const abs = path.resolve(storageRoot, rel);
  const relative = path.relative(storageRoot, abs);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return abs;
}

function extFor(kind: SessionMediaKind, fileName: string, mimeType: string): string {
  const fromName = path.extname(fileName);
  if (fromName) return fromName;
  if (kind === "video") return ".mp4";
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  if (mimeType.includes("webp")) return ".webp";
  return ".bin";
}

export async function buildSessionMediaZip(
  db: Database,
  sessionId: string,
  kind: SessionMediaKind,
): Promise<{ buffer: Buffer; count: number } | { empty: true }> {
  const column = kind === "image" ? "image_asset_id" : "video_asset_id";
  const rows = await db.all<{
    message_id: string;
    file_path: string;
    file_name: string;
    mime_type: string;
  }[]>(
    `SELECT m.id AS message_id, a.file_path, a.file_name, a.mime_type
     FROM chat_messages m
     INNER JOIN assets a ON a.id = m.${column}
     WHERE m.session_id = ? AND m.${column} IS NOT NULL AND TRIM(m.${column}) != ''
     ORDER BY datetime(m.created_at) ASC, m.id ASC`,
    sessionId,
  );

  if (!rows.length) return { empty: true };

  const zip = new JSZip();
  let index = 0;
  for (const row of rows) {
    const abs = resolveUnderStorage(row.file_path);
    if (!abs) continue;
    try {
      const buf = await readFile(abs);
      index += 1;
      const ext = extFor(kind, row.file_name, row.mime_type);
      const prefix = String(index).padStart(3, "0");
      zip.file(`${prefix}_${row.message_id}${ext}`, buf);
    } catch {
      continue;
    }
  }

  if (index === 0) return { empty: true };

  const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  return { buffer, count: index };
}
