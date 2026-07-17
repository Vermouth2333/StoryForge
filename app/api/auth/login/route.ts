import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";
import { attachSessionCookie } from "@/lib/session-cookie";

const bodySchema = z.object({
  username: z.string().trim().min(1, "请输入用户名").max(32),
  password: z.string().min(1, "请输入密码").max(72),
});

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = rateLimitAllow(`auth_login:${ip}`, 30, 15 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ code: 429, msg: "登录尝试过多，请稍后再试" }, { status: 429 });
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    return NextResponse.json({ code: 503, msg: "服务器未配置 JWT_SECRET" }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "参数无效";
    return NextResponse.json({ code: 400, msg }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const db = await getDb();

  const user = await db.get<{
    id: string;
    status: string | null;
    password_hash: string | null;
  }>(
    `SELECT id, status, password_hash FROM users
     WHERE username = ?
       AND COALESCE(status, 'active') != 'deleted'
     LIMIT 1`,
    username,
  );

  if (!user?.password_hash) {
    return NextResponse.json({ code: 401, msg: "用户名或密码错误" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ code: 401, msg: "用户名或密码错误" }, { status: 401 });
  }

  if (user.status && user.status !== "active") {
    return NextResponse.json({ code: 403, msg: "账号不可用" }, { status: 403 });
  }

  const res = NextResponse.json({
    code: 200,
    msg: "登录成功",
    data: { user_id: user.id },
  });
  return attachSessionCookie(res, user.id);
}
