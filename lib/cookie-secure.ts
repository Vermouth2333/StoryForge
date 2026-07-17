/** Cookie Secure 标志：HTTPS 部署设 COOKIE_SECURE=true；HTTP IP 访问保持 false */
export function cookieSecure(): boolean {
  const raw = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return process.env.NODE_ENV === "production";
}
