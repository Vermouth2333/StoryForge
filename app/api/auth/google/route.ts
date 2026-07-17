import { NextResponse } from "next/server";

/** Google 登录已停用，统一走账密登录页 */
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/login", req.url));
}
