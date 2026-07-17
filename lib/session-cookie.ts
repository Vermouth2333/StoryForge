import { NextResponse } from "next/server";
import { cookieSecure } from "@/lib/cookie-secure";
import { signSessionJwt } from "@/lib/session-jwt";

export async function attachSessionCookie(res: NextResponse, userId: string) {
  const sessionJwt = await signSessionJwt(userId);
  res.cookies.set("sf_session", sessionJwt, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
