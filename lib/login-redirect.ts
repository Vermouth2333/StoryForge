/**
 * 构建登录页地址；登录成功后回到 nextPath（须为本站相对路径）。
 */
export function loginHref(nextPath?: string | null): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/login";
  }
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

/** 当前浏览器路径（含 query），供登录后回跳。 */
export function currentPathForLogin(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}
