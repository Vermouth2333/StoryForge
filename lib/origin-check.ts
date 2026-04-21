/**
 * 变更类 API 的 Origin / 浏览器来源校验（CSRF 纵深防御，配合 SameSite Cookie）。
 * 开发环境默认不启用；生产环境可通过 STORYFORGE_RELAX_ORIGIN_CHECK=1 临时关闭（仅排障）。
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function shouldEnforceOriginCheck(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.STORYFORGE_RELAX_ORIGIN_CHECK === "1") return false;
  return true;
}

function hostMatches(originHost: string, requestHost: string): boolean {
  const oh = originHost.split(":")[0];
  const rh = requestHost.split(":")[0];
  if (oh === rh) return true;
  if (oh === `www.${rh}` || rh === `www.${oh}`) return true;
  return false;
}

function allowedExtraOrigin(originUrl: string, originHostname: string): boolean {
  const raw = process.env.STORYFORGE_ALLOWED_ORIGINS;
  if (!raw?.trim()) return false;
  for (const piece of raw.split(",")) {
    const t = piece.trim();
    if (!t) continue;
    try {
      const u = new URL(t);
      if (u.host.toLowerCase() === originHostname.toLowerCase()) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** 返回 true 表示应拒绝请求 */
export function isCrossSiteMutationBlocked(req: Request): boolean {
  if (!shouldEnforceOriginCheck()) return false;
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return false;

  const hostHeader = req.headers.get("host")?.toLowerCase();
  if (!hostHeader) return true;

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      const oh = o.host.toLowerCase();
      if (hostMatches(oh, hostHeader)) return false;
      if (allowedExtraOrigin(origin, oh)) return false;
      return true;
    } catch {
      return true;
    }
  }

  const sfs = req.headers.get("sec-fetch-site");
  if (sfs === "same-origin" || sfs === "same-site") {
    return false;
  }

  // 无 Origin 且非浏览器典型跨站标记：可能是脚本 / 错误配置
  return true;
}
