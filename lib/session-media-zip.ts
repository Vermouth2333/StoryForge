import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import type { Database } from "sqlite";

export type SessionMediaKind = "image" | "video";

export type SessionMediaFile = {
  kind: SessionMediaKind;
  messageId: string;
  assetId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
};

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

export async function listSessionMedia(
  db: Database,
  sessionId: string,
  kind: SessionMediaKind | "all",
): Promise<SessionMediaFile[]> {
  const kinds: SessionMediaKind[] = kind === "all" ? ["image", "video"] : [kind];
  const out: SessionMediaFile[] = [];
  for (const k of kinds) {
    const column = k === "image" ? "image_asset_id" : "video_asset_id";
    const rows = await db.all<{
      message_id: string;
      asset_id: string;
      file_path: string;
      file_name: string;
      mime_type: string;
    }[]>(
      `SELECT m.id AS message_id, a.id AS asset_id, a.file_path, a.file_name, a.mime_type
       FROM chat_messages m
       INNER JOIN assets a ON a.id = m.${column}
       WHERE m.session_id = ? AND m.${column} IS NOT NULL AND TRIM(m.${column}) != ''
       ORDER BY datetime(m.created_at) ASC, m.id ASC`,
      sessionId,
    );
    for (const row of rows) {
      out.push({
        kind: k,
        messageId: row.message_id,
        assetId: row.asset_id,
        filePath: row.file_path,
        fileName: row.file_name,
        mimeType: row.mime_type,
      });
    }
  }
  return out;
}

export async function buildSessionMediaZip(
  db: Database,
  sessionId: string,
  kind: SessionMediaKind | "all",
): Promise<{ buffer: Buffer; count: number } | { empty: true }> {
  const rows = await listSessionMedia(db, sessionId, kind);
  if (!rows.length) return { empty: true };

  const zip = new JSZip();
  const counters: Record<SessionMediaKind, number> = { image: 0, video: 0 };
  for (const row of rows) {
    const abs = resolveUnderStorage(row.filePath);
    if (!abs) continue;
    try {
      const buf = await readFile(abs);
      counters[row.kind] += 1;
      const ext = extFor(row.kind, row.fileName, row.mimeType);
      const prefix = String(counters[row.kind]).padStart(3, "0");
      const folder = kind === "all" ? (row.kind === "image" ? "images/" : "videos/") : "";
      zip.file(`${folder}${prefix}_${row.messageId}${ext}`, buf);
    } catch {
      continue;
    }
  }

  const count = counters.image + counters.video;
  if (count === 0) return { empty: true };

  const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  return { buffer, count };
}
