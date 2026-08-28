import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(50, Number(url.searchParams.get("page_size") ?? "20"));
  const offset = (Math.max(page, 1) - 1) * pageSize;

  const db = await getDb();
  const rows = await db.all<{
    id: string;
    type: string;
    payload_json: string;
    is_read: number;
    created_at: string;
  }[]>(
    `SELECT id, type, payload_json, is_read, created_at
     FROM notifications
     WHERE receiver_user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    userId,
    pageSize,
    offset,
  );

  const parsedRows = rows.map((row) => ({
    ...row,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
  }));

  const actorIds = [
    ...new Set(
      parsedRows
        .map((row) => (typeof row.payload.actor_user_id === "string" ? row.payload.actor_user_id : ""))
        .filter(Boolean),
    ),
  ];
  const nameById = new Map<string, string>();
  if (actorIds.length > 0) {
    const placeholders = actorIds.map(() => "?").join(",");
    const users = await db.all<{ id: string; username: string | null }[]>(
      `SELECT id, username FROM users WHERE id IN (${placeholders})`,
      ...actorIds,
    );
    for (const u of users) {
      nameById.set(u.id, (u.username ?? "").trim() || "匿名用户");
    }
  }

  const data = parsedRows.map((row) => {
    const actorId = typeof row.payload.actor_user_id === "string" ? row.payload.actor_user_id : "";
    return {
      ...row,
      payload: {
        ...row.payload,
        actor_username: (actorId && nameById.get(actorId)) || row.payload.actor_username || "匿名用户",
      },
    };
  });

  return NextResponse.json({ code: 200, data, msg: "ok" });
}
