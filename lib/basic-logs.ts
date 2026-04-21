import type { Database } from "sqlite";
import { getDb, id, nowIso } from "@/lib/db";

export async function logBasic(
  db: Database,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  opts?: {
    category?: string;
    meta?: Record<string, unknown>;
    user_id?: string | null;
  },
): Promise<void> {
  await db.run(
    `INSERT INTO basic_logs (id, level, category, message, meta_json, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id("log"),
    level,
    opts?.category ?? "",
    message,
    JSON.stringify(opts?.meta ?? {}),
    opts?.user_id ?? null,
    nowIso(),
  );
}

/** 独立调用：失败时仅 console，避免日志本身拖垮请求 */
export async function logBasicSafe(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  opts?: {
    category?: string;
    meta?: Record<string, unknown>;
    user_id?: string | null;
  },
): Promise<void> {
  try {
    const db = await getDb();
    await logBasic(db, level, message, opts);
  } catch (e) {
    console.error("[basic_logs]", message, e);
  }
}
