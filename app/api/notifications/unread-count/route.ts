import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 200, data: { unread: 0 }, msg: "ok" });
  }
  const db = await getDb();
  const row = await db.get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM notifications WHERE receiver_user_id = ? AND is_read = 0",
    userId,
  );
  return NextResponse.json({ code: 200, data: { unread: row?.count ?? 0 }, msg: "ok" });
}
