import { NextResponse } from "next/server";

/** Google OAuth 回调已停用 */
export async function GET(req: Request) {
  const url = new URL("/login", req.url);
  url.searchParams.set("auth", "google_disabled");
  return NextResponse.redirect(url);
}
