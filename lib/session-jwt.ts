import { SignJWT, jwtVerify } from "jose";
import { serverEnv } from "@/lib/server-env";

function getJwtSecretKey(): Uint8Array {
  const raw = serverEnv("JWT_SECRET");
  if (!raw || raw.length < 16) {
    throw new Error("JWT_SECRET 未配置或过短（建议 ≥32 字符）");
  }
  return new TextEncoder().encode(raw);
}

export async function signSessionJwt(userId: string): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySessionJwt(token: string): Promise<string | null> {
  const raw = serverEnv("JWT_SECRET");
  if (!raw || raw.length < 16) {
    return null;
  }
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(token, key);
    const uid = payload.uid;
    if (typeof uid !== "string" || !uid) return null;
    return uid;
  } catch {
    return null;
  }
}
