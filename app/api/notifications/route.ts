import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(50, Number(url.searchParams.get("page_size") ?? "20"));
  const offset = (Math.max(page, 1) - 1) * pageSize;

  const db = await getDb();
  const rows = await db.all(
    `SELECT id, type, payload_json, is_read, created_at
     FROM notifications
     WHERE receiver_user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    userId,
    pageSize,
    offset,
  );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}
