import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageCredits } from "@/lib/credit-admin";

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  if (!(await canManageCredits(userId))) {
    return NextResponse.json({ code: 403, msg: "需要管理员权限" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const db = await getDb();
  const rows = q
    ? await db.all<{ id: string; username: string | null; credits: number | null }[]>(
        `SELECT id, username, credits FROM users
         WHERE COALESCE(status, 'active') != 'deleted' AND username LIKE ?
         ORDER BY updated_at DESC LIMIT 30`,
        `%${q}%`,
      )
    : await db.all<{ id: string; username: string | null; credits: number | null }[]>(
        `SELECT id, username, credits FROM users
         WHERE COALESCE(status, 'active') != 'deleted'
         ORDER BY updated_at DESC LIMIT 30`,
      );

  return NextResponse.json({
    code: 200,
    data: rows.map((r) => ({
      id: r.id,
      username: r.username,
      credits: Number(r.credits ?? 0),
    })),
  });
}
