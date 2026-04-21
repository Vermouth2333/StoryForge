import { cookies, headers } from "next/headers";
import { verifySessionJwt } from "@/lib/session-jwt";

/**
 * 当前用户 ID：优先 JWT（HttpOnly `sf_session`），其次调试头 / 旧 Demo Cookie，最后默认演示账号。
 */
export async function getCurrentUserId() {
  const h = await headers();
  const c = await cookies();

  const sessionTok = c.get("sf_session")?.value;
  if (sessionTok) {
    const uid = await verifySessionJwt(sessionTok);
    if (uid) return uid;
  }

  const hdr = h.get("x-user-id");
  if (hdr) return hdr;

  const legacy = c.get("sf_user_id")?.value;
  if (legacy) return legacy;

  return "demo_user_google_123456";
}
