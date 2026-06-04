/**
 * 防重放请求头（客户端）：为发布/注销等敏感接口生成 x-timestamp 与 x-nonce。
 * 服务端在 5 分钟时窗内校验 nonce 唯一性（见 lib/anti-replay.ts）。
 */
export function replayHeaders(): Record<string, string> {
  const nonce =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return {
    "x-timestamp": String(Date.now()),
    "x-nonce": nonce,
  };
}
