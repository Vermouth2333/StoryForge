/** Read server env at runtime. Dynamic keys avoid Next.js inlining empty values during Docker build. */
export function serverEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}
