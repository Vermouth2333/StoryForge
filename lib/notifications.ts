import { type Database } from "sqlite";
import { id, nowIso } from "@/lib/db";

export async function createNotification(
  db: Database,
  receiverUserId: string,
  type: "liked" | "followed" | "author_update" | "system",
  payload: Record<string, unknown>,
) {
  await db.run(
    `INSERT INTO notifications (id, receiver_user_id, type, payload_json, is_read, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    id("noti"),
    receiverUserId,
    type,
    JSON.stringify(payload),
    nowIso(),
  );
}
