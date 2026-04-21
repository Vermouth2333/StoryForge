/** 根据反向代理头还原对外访问 origin（OAuth redirect_uri 必须与 Google 控制台一致）。 */
export function getAppOrigin(req: Request): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host") ?? "localhost:3000";
  const proto =
    forwardedProto ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
