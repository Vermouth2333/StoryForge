import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-origin";
import { getDb } from "@/lib/db";
import { signSessionJwt } from "@/lib/session-jwt";
import { ensureGoogleUser } from "@/lib/user";

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

export async function GET(req: Request) {
  const origin = getAppOrigin(req);
  const base = new URL("/", origin);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthErr = url.searchParams.get("error");

  if (oauthErr) {
    base.searchParams.set("auth", `google_error:${oauthErr}`);
    return NextResponse.redirect(base);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("sf_oauth_state")?.value;
  cookieStore.delete("sf_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    base.searchParams.set("auth", "invalid_state");
    return NextResponse.redirect(base);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json({ code: 503, msg: "OAuth 凭据未配置" }, { status: 503 });
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    return NextResponse.json({ code: 503, msg: "JWT_SECRET 未配置" }, { status: 503 });
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error("[google oauth token]", tokenJson);
    base.searchParams.set("auth", "token_exchange_failed");
    return NextResponse.redirect(base);
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = (await userRes.json()) as GoogleUserInfo;
  const sub = profile.sub;
  if (!sub) {
    base.searchParams.set("auth", "no_sub");
    return NextResponse.redirect(base);
  }

  const db = await getDb();
  await ensureGoogleUser(db, sub, {
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  });

  const userId = `google_${sub}`;
  const sessionJwt = await signSessionJwt(userId);

  const res = NextResponse.redirect(base);
  res.cookies.set("sf_session", sessionJwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
