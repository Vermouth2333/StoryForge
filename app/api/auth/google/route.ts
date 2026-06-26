import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-origin";

/** 跳转 Google 授权页（需在 Google Cloud Console 登记 redirect_uri = …/api/auth/google/callback） */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { code: 503, msg: "Google OAuth 未配置：请设置 GOOGLE_CLIENT_ID 与 GOOGLE_CLIENT_SECRET、JWT_SECRET" },
      { status: 503 },
    );
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    return NextResponse.json(
      { code: 503, msg: "JWT_SECRET 未配置或过短（建议 ≥32 字符）" },
      { status: 503 },
    );
  }

  const origin = getAppOrigin(req);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = crypto.randomBytes(24).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("sf_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.redirect(url);
}
