import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** 清除会话 Cookie（JWT + 旧 Demo Cookie），确保用户被踢出登录 */
export async function POST() {
  const c = await cookies();
  c.delete("sf_session");
  c.delete("sf_user_id");
  return NextResponse.json({ code: 200, msg: "已退出登录" });
}
