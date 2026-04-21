import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** 清除会话 Cookie（JWT） */
export async function POST() {
  const c = await cookies();
  c.delete("sf_session");
  return NextResponse.json({ code: 200, msg: "已退出登录" });
}
