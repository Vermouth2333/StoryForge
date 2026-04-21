type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

/** 固定时间窗计数；适用于 MVP 单机进程内限流（多实例需 Redis 等）。 */
export function rateLimitAllow(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  let b = store.get(key);
  if (!b || now >= b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= max) {
    return { ok: false, retryAfterMs: Math.max(1, b.resetAt - now) };
  }
  b.count += 1;
  return { ok: true };
}

export function getRequestIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}
