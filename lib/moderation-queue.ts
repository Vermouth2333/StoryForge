import type { Database } from "sqlite";
import { logBasicSafe } from "@/lib/basic-logs";
import { id, nowIso } from "@/lib/db";

export type ModerationContentType = "story" | "character" | "world";

/** 发布被敏感规则拦截时写入审核队列 */
export async function enqueueSensitivePublishBlock(
  db: Database,
  opts: {
    contentType: ModerationContentType;
    targetId: string;
    submitterUserId: string;
  },
): Promise<void> {
  const mid = id("mod");
  const ts = nowIso();
  await db.run(
    `INSERT INTO moderation_items
     (id, content_type, target_id, trigger_reason, submitter_user_id, status, audit_remark, reviewed_by, reviewed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', '', NULL, NULL, ?, ?)`,
    mid,
    opts.contentType,
    opts.targetId,
    "publish_blocked_sensitive",
    opts.submitterUserId,
    ts,
    ts,
  );
}

export async function adminForceTakeDown(
  db: Database,
  contentType: string,
  targetId: string,
): Promise<void> {
  const now = nowIso();
  if (contentType === "story") {
    await db.run(
      "UPDATE stories SET status = 'draft', publish_at = NULL, updated_at = ? WHERE id = ?",
      now,
      targetId,
    );
  } else if (contentType === "character") {
    await db.run(
      "UPDATE characters SET status = 'draft', publish_at = NULL, updated_at = ? WHERE id = ?",
      now,
      targetId,
    );
  } else if (contentType === "world") {
    await db.run(
      "UPDATE worlds SET status = 'draft', publish_at = NULL, updated_at = ? WHERE id = ?",
      now,
      targetId,
    );
  }
}

export async function logModerationDecision(
  adminUserId: string,
  itemId: string,
  status: string,
  meta: Record<string, unknown>,
): Promise<void> {
  await logBasicSafe("info", "moderation decision", {
    category: "moderation",
    meta: { itemId, status, ...meta },
    user_id: adminUserId,
  });
}
