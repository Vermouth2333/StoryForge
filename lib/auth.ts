import { cookies, headers } from "next/headers";
import { verifySessionJwt } from "@/lib/session-jwt";

/**
 * 当前用户 ID：优先 JWT（HttpOnly `sf_session`），其次调试头。
 * 未登录时返回 null，调用方需自行处理。
 */
export async function getCurrentUserId(): Promise<string | null> {
  const h = await headers();
  const c = await cookies();

  const sessionTok = c.get("sf_session")?.value;
  if (sessionTok) {
    const uid = await verifySessionJwt(sessionTok);
    if (uid) return uid;
  }

  const hdr = h.get("x-user-id");
  if (hdr) return hdr;

  return null;
}
