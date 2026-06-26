import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { maskCnPhone, sanitizePlainText } from "@/lib/text";
import { ensureUserRow } from "@/lib/user";
import { isAdminUser } from "@/lib/admin-auth";

const patchSchema = z.object({
  username: z.string().min(1).max(40).optional(),
  gender: z.union([z.string().max(20), z.literal("")]).optional(),
  age: z.union([z.number().int().min(0).max(130), z.null()]).optional(),
  phone: z.union([z.string(), z.literal("")]).optional(),
  bio: z.string().max(500).optional(),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const db = await getDb();
  await ensureUserRow(db, userId);

  const row = await db.get<{
    id: string;
    email: string | null;
    username: string | null;
    avatar_url: string | null;
    gender: string | null;
    age: number | null;
    phone_masked: string | null;
    bio: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, email, username, avatar_url, gender, age, phone_masked, bio, status, created_at, updated_at
     FROM users WHERE id = ?`,
    userId,
  );

  if (row?.status === "deleted") {
    const res = NextResponse.json({ code: 410, msg: "账号已注销" }, { status: 410 });
    res.cookies.delete("sf_session");
    res.cookies.delete("sf_user_id");
    return res;
  }

  return NextResponse.json({ code: 200, data: { ...row, is_admin: isAdminUser(userId) }, msg: "ok" });
}

export async function PATCH(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const db = await getDb();
  await ensureUserRow(db, userId);

  const st = await db.get<{ status: string }>("SELECT status FROM users WHERE id = ?", userId);
  if (st?.status === "deleted") {
    const res = NextResponse.json({ code: 410, msg: "账号已注销" }, { status: 410 });
    res.cookies.delete("sf_session");
    res.cookies.delete("sf_user_id");
    return res;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (parsed.data.username !== undefined) {
    fields.push("username = ?");
    values.push(parsed.data.username.trim());
  }
  if (parsed.data.gender !== undefined) {
    fields.push("gender = ?");
    values.push(parsed.data.gender === "" ? null : parsed.data.gender.trim());
  }
  if (parsed.data.age !== undefined) {
    if (parsed.data.age !== null && (Number.isNaN(parsed.data.age) || parsed.data.age < 0)) {
      return NextResponse.json({ code: 400, msg: "年龄无效" }, { status: 400 });
    }
    fields.push("age = ?");
    values.push(parsed.data.age);
  }
  if (parsed.data.phone !== undefined) {
    if (parsed.data.phone === "") {
      fields.push("phone_masked = ?");
      values.push(null);
    } else {
      const masked = maskCnPhone(parsed.data.phone.replace(/\D/g, ""));
      if (!masked) {
        return NextResponse.json(
          { code: 400, msg: "手机号需为大陆 11 位数字" },
          { status: 400 },
        );
      }
      fields.push("phone_masked = ?");
      values.push(masked);
    }
  }
  if (parsed.data.bio !== undefined) {
    fields.push("bio = ?");
    values.push(sanitizePlainText(parsed.data.bio, 500));
  }

  if (fields.length === 0) {
    return NextResponse.json({ code: 400, msg: "无更新项" }, { status: 400 });
  }

  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(userId);

  await db.run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, ...values);
  return NextResponse.json({ code: 200, msg: "保存成功" });
}
