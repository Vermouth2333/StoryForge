import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, id, nowIso } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";
import { attachSessionCookie } from "@/lib/session-cookie";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "用户名至少 3 个字符")
    .max(32, "用户名最多 32 个字符")
    .regex(/^[\w\u4e00-\u9fff-]+$/u, "用户名仅支持中文、字母、数字、下划线和连字符"),
  password: z.string().min(8, "密码至少 8 位").max(72, "密码过长"),
});

export async function POST(req: Request) {
  const rl = rateLimitAllow(`auth_register:${getRequestIp(req)}`, 10, 3_600_000);
  if (!rl.ok) {
    return NextResponse.json({ code: 429, msg: "注册过于频繁，请稍后再试" }, { status: 429 });
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

  const takenName = await db.get<{ id: string }>(
    `SELECT id FROM users WHERE username = ? AND COALESCE(status, 'active') != 'deleted' LIMIT 1`,
    username,
  );
  if (takenName) {
    return NextResponse.json({ code: 409, msg: "用户名已被占用" }, { status: 409 });
  }

  const userId = id("user");
  const now = nowIso();
  const passwordHash = await hashPassword(password);

  await db.run(
    `INSERT INTO users (id, email, username, avatar_url, status, password_hash, created_at, updated_at)
     VALUES (?, NULL, ?, NULL, 'active', ?, ?, ?)`,
    userId,
    username,
    passwordHash,
    now,
    now,
  );

  const res = NextResponse.json({
    code: 200,
    msg: "注册成功",
    data: { user_id: userId, username },
  });
  return attachSessionCookie(res, userId);
}
