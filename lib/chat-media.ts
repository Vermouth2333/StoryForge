import { rm } from "node:fs/promises";
import path from "node:path";
import type { Database } from "sqlite";
import { getDb } from "@/lib/db";

export async function deleteOwnedChatAsset(
  db: Database,
  assetId: string | null | undefined,
  userId: string,
): Promise<void> {
  if (!assetId) return;
  const asset = await db.get<{ id: string }>(
    "SELECT id FROM assets WHERE id = ? AND user_id = ?",
    assetId,
    userId,
  );
  if (!asset) return;
  await db.run("DELETE FROM assets WHERE id = ?", assetId);
  const assetDir = path.join(process.cwd(), "storage", "users", userId, "assets", assetId);
  await rm(assetDir, { recursive: true, force: true }).catch(() => undefined);
}

export async function removeChatMessageMedia(args: {
  userId: string;
  messageId: string;
  kind: "image" | "video";
}): Promise<{ ok: true } | { ok: false; status: number; msg: string }> {
  const db = await getDb();
  const row = await db.get<{
    id: string;
    image_asset_id: string | null;
    video_asset_id: string | null;
  }>(
    `SELECT m.id, m.image_asset_id, m.video_asset_id
     FROM chat_messages m
     INNER JOIN chat_sessions s ON s.id = m.session_id
     WHERE m.id = ? AND s.user_id = ?`,
    args.messageId,
    args.userId,
  );
  if (!row) {
    return { ok: false, status: 404, msg: "消息不存在" };
  }

  if (args.kind === "image") {
    await db.run("UPDATE chat_messages SET image_asset_id = NULL WHERE id = ?", row.id);
    await deleteOwnedChatAsset(db, row.image_asset_id, args.userId);
    return { ok: true };
  }

  await db.run(
    `UPDATE chat_messages
     SET video_asset_id = NULL, video_status = NULL, video_error = NULL,
         video_request_id = NULL, video_started_at = NULL
     WHERE id = ?`,
    row.id,
  );
  await deleteOwnedChatAsset(db, row.video_asset_id, args.userId);
  return { ok: true };
}
