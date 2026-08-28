import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { grantCredits } from "@/lib/credits";
import { canManageCredits } from "@/lib/credit-admin";

const schema = z.object({
  username: z.string().trim().min(1).max(40),
  amount: z.number().int().min(1).max(1_000_000),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  if (!(await canManageCredits(userId))) {
    return NextResponse.json({ code: 403, msg: "需要管理员权限" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const db = await getDb();
  const target = await db.get<{ id: string; username: string | null; credits: number | null }>(
    `SELECT id, username, credits FROM users
     WHERE username = ? COLLATE NOCASE AND COALESCE(status, 'active') != 'deleted'
     LIMIT 1`,
    parsed.data.username,
  );
  if (!target) {
    return NextResponse.json({ code: 404, msg: "用户不存在" }, { status: 404 });
  }

  const balance = await grantCredits({
    targetUserId: target.id,
    amount: parsed.data.amount,
    operatorUserId: userId,
    note: parsed.data.note?.trim() || undefined,
  });

  return NextResponse.json({
    code: 200,
    msg: `已向 ${target.username} 发放 ${parsed.data.amount} 积分`,
    data: { username: target.username, balance },
  });
}
