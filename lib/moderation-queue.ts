import type { Database } from "sqlite";
import { logBasicSafe } from "@/lib/basic-logs";
import { id, nowIso } from "@/lib/db";
import { invalidateMarketCache } from "@/lib/invalidate-market-cache";
import { createNotification } from "@/lib/notifications";

export type ModerationContentType = "story" | "character" | "world";

export const PENDING_REVIEW_STATUS = "pending_review";

const WORK_TABLE: Record<ModerationContentType, "stories" | "characters" | "worlds"> = {
  story: "stories",
  character: "characters",
  world: "worlds",
};

function isContentType(value: string): value is ModerationContentType {
  return value === "story" || value === "character" || value === "world";
}

async function loadWorkMeta(
  db: Database,
  contentType: ModerationContentType,
  targetId: string,
): Promise<{ author_id: string; title: string } | null> {
  if (contentType === "story") {
    const row = await db.get<{ author_id: string; title: string }>(
      "SELECT author_id, title FROM stories WHERE id = ?",
      targetId,
    );
    return row ? { author_id: row.author_id, title: row.title } : null;
  }
  if (contentType === "character") {
    const row = await db.get<{ author_id: string; name: string }>(
      "SELECT author_id, name FROM characters WHERE id = ?",
      targetId,
    );
    return row ? { author_id: row.author_id, title: row.name } : null;
  }
  const row = await db.get<{ author_id: string; name: string }>(
    "SELECT author_id, name FROM worlds WHERE id = ?",
    targetId,
  );
  return row ? { author_id: row.author_id, title: row.name } : null;
}

async function notifyFollowersOfPublish(
  db: Database,
  contentType: ModerationContentType,
  targetId: string,
  authorId: string,
  title: string,
) {
  const followers = await db.all<{ user_id: string }[]>(
    "SELECT user_id FROM follows WHERE author_id = ?",
    authorId,
  );
  for (const row of followers) {
    await createNotification(db, row.user_id, "author_update", {
      author_id: authorId,
      story_id: contentType === "story" ? targetId : undefined,
      character_id: contentType === "character" ? targetId : undefined,
      world_id: contentType === "world" ? targetId : undefined,
      story_title: title,
      content_kind: contentType,
    });
  }
}

/** 发布被敏感规则拦截：作品进入审核中，不出现在市场 */
export async function submitSensitivePublishForReview(
  db: Database,
  opts: {
    contentType: ModerationContentType;
    targetId: string;
    submitterUserId: string;
    title: string;
  },
): Promise<void> {
  const table = WORK_TABLE[opts.contentType];
  const ts = nowIso();
  await db.run(
    `UPDATE ${table} SET status = ?, publish_at = NULL, updated_at = ? WHERE id = ?`,
    PENDING_REVIEW_STATUS,
    ts,
    opts.targetId,
  );

  const existing = await db.get<{ id: string }>(
    `SELECT id FROM moderation_items
     WHERE content_type = ? AND target_id = ? AND status = 'pending'
     LIMIT 1`,
    opts.contentType,
    opts.targetId,
  );
  if (existing) {
    await db.run("UPDATE moderation_items SET updated_at = ? WHERE id = ?", ts, existing.id);
  } else {
    await db.run(
      `INSERT INTO moderation_items
       (id, content_type, target_id, trigger_reason, submitter_user_id, status, audit_remark, reviewed_by, reviewed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', '', NULL, NULL, ?, ?)`,
      id("mod"),
      opts.contentType,
      opts.targetId,
      "publish_blocked_sensitive",
      opts.submitterUserId,
      ts,
      ts,
    );
  }

  await createNotification(db, opts.submitterUserId, "system", {
    kind: "moderation_submitted",
    content_type: opts.contentType,
    target_id: opts.targetId,
    title: opts.title,
  });
}

/** 作者修改后直接发布时，关闭仍待处理的审核单 */
export async function resolvePendingItemsOnDirectPublish(
  db: Database,
  contentType: ModerationContentType,
  targetId: string,
): Promise<void> {
  const ts = nowIso();
  await db.run(
    `UPDATE moderation_items
     SET status = 'approved', audit_remark = '作者修改后直接发布', reviewed_at = ?, updated_at = ?
     WHERE content_type = ? AND target_id = ? AND status = 'pending'`,
    ts,
    ts,
    contentType,
    targetId,
  );
}

export async function adminPublishApprovedWork(
  db: Database,
  contentType: string,
  targetId: string,
): Promise<void> {
  if (!isContentType(contentType)) return;
  const table = WORK_TABLE[contentType];
  const now = nowIso();
  const meta = await loadWorkMeta(db, contentType, targetId);
  const prev = await db.get<{ status: string }>(`SELECT status FROM ${table} WHERE id = ?`, targetId);
  await db.run(
    `UPDATE ${table} SET status = 'published', publish_at = ?, updated_at = ? WHERE id = ?`,
    now,
    now,
    targetId,
  );
  if (meta && prev?.status !== "published") {
    await notifyFollowersOfPublish(db, contentType, targetId, meta.author_id, meta.title);
  }
  if (meta) {
    await createNotification(db, meta.author_id, "system", {
      kind: "moderation_approved",
      content_type: contentType,
      target_id: targetId,
      title: meta.title,
    });
  }
  await invalidateMarketCache();
}

export async function adminForceTakeDown(
  db: Database,
  contentType: string,
  targetId: string,
): Promise<void> {
  if (!isContentType(contentType)) return;
  const table = WORK_TABLE[contentType];
  const now = nowIso();
  await db.run(
    `UPDATE ${table} SET status = 'draft', publish_at = NULL, updated_at = ? WHERE id = ?`,
    now,
    targetId,
  );
  await invalidateMarketCache();
}

export async function adminRejectWork(
  db: Database,
  contentType: string,
  targetId: string,
  remark: string,
): Promise<void> {
  await adminForceTakeDown(db, contentType, targetId);
  if (!isContentType(contentType)) return;
  const meta = await loadWorkMeta(db, contentType, targetId);
  if (!meta) return;
  await createNotification(db, meta.author_id, "system", {
    kind: "moderation_rejected",
    content_type: contentType,
    target_id: targetId,
    title: meta.title,
    remark,
  });
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
