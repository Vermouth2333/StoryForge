import { getDb } from "@/lib/db";

/**
 * 防重放校验（见 docs/StoryForge_技术文档.md 安全章节）：
 * 发布/注销等敏感接口要求请求头携带 `x-timestamp` 与 `x-nonce`，
 * 服务端校验时间戳处于 5 分钟时窗内，且同一 nonce 在该时窗内不可重复使用。
 */

/** 时窗：5 分钟（毫秒） */
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export interface ReplayGuardResult {
  ok: boolean;
  status: number;
  msg: string;
}

const OK: ReplayGuardResult = { ok: true, status: 200, msg: "ok" };

/**
 * 校验请求是否通过防重放检查；通过时会消费（落库）该 nonce。
 * 调用方应在执行敏感操作前调用，并在 !ok 时直接返回对应状态码。
 */
export async function verifyReplayGuard(
  req: Request,
  userId?: string,
): Promise<ReplayGuardResult> {
  const tsRaw = req.headers.get("x-timestamp");
  const nonce = req.headers.get("x-nonce");

  if (!tsRaw || !nonce) {
    return { ok: false, status: 400, msg: "缺少防重放请求头 x-timestamp / x-nonce" };
  }

  const ts = Number(tsRaw);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 400, msg: "x-timestamp 非法" };
  }

  // nonce 长度限制，避免异常超长输入
  if (nonce.length < 8 || nonce.length > 128) {
    return { ok: false, status: 400, msg: "x-nonce 非法" };
  }

  const now = Date.now();
  if (Math.abs(now - ts) > REPLAY_WINDOW_MS) {
    return { ok: false, status: 401, msg: "请求已过期，请重试" };
  }

  const db = await getDb();

  // 清理过期 nonce，控制表体积
  await db.run("DELETE FROM used_nonces WHERE created_at < ?", now - REPLAY_WINDOW_MS);

  try {
    await db.run(
      "INSERT INTO used_nonces (nonce, user_id, created_at) VALUES (?, ?, ?)",
      nonce,
      userId ?? null,
      now,
    );
  } catch {
    // 主键冲突即为重复 nonce（重放）
    return { ok: false, status: 409, msg: "重复请求已被拦截" };
  }

  return OK;
}
