import { copyFile, mkdir } from "fs/promises";
import path from "path";
import type { Database } from "sqlite";
import { id, nowIso } from "@/lib/db";

export type DownloadWorkType = "character" | "world" | "story";

type SnapshotResult =
  | { ok: true; localWorkId: string; alreadyHad: boolean; sourceVersion: number }
  | { ok: false; msg: string; status: number };

/**
 * 将封面文件复制为下载者自有 asset，避免仍指向原作者资源导致本地副本无封面。
 */
async function cloneCoverAsset(
  db: Database,
  sourceAssetId: string | null | undefined,
  userId: string,
  targetType: DownloadWorkType,
  targetId: string,
): Promise<string | null> {
  if (!sourceAssetId) return null;

  const src = await db.get<{
    file_name: string;
    file_path: string;
    thumbnail_path: string | null;
    file_size_bytes: number;
    mime_type: string;
  }>(
    `SELECT file_name, file_path, thumbnail_path, file_size_bytes, mime_type
     FROM assets WHERE id = ?`,
    sourceAssetId,
  );
  if (!src?.file_path) return null;

  const storageRoot = path.join(process.cwd(), "storage");
  const srcFile = path.join(storageRoot, src.file_path);
  const assetId = id("asset");
  const originalDir = path.join(storageRoot, "users", userId, "assets", assetId, "original");
  const thumbnailDir = path.join(storageRoot, "users", userId, "assets", assetId, "thumbnails");
  await mkdir(originalDir, { recursive: true });
  await mkdir(thumbnailDir, { recursive: true });

  const ext = path.extname(src.file_path) || path.extname(src.file_name) || ".webp";
  const fileName = `cover_${assetId}${ext}`;
  const destFile = path.join(originalDir, fileName);

  try {
    await copyFile(srcFile, destFile);
  } catch (e) {
    console.error("克隆封面原图失败:", e);
    return null;
  }

  let thumbRel: string | null = null;
  if (src.thumbnail_path) {
    const destThumb = path.join(thumbnailDir, "thumb_200x200.jpg");
    try {
      await copyFile(path.join(storageRoot, src.thumbnail_path), destThumb);
      thumbRel = path.relative(storageRoot, destThumb).replace(/\\/g, "/");
    } catch (e) {
      console.error("克隆封面缩略图失败:", e);
    }
  }

  const relativePath = path.relative(storageRoot, destFile).replace(/\\/g, "/");
  const now = nowIso();
  await db.run(
    `INSERT INTO assets
     (id, user_id, asset_type, target_type, target_id, file_name, file_path, thumbnail_path, file_size_bytes, mime_type, created_at)
     VALUES (?, ?, 'cover', ?, ?, ?, ?, ?, ?, ?, ?)`,
    assetId,
    userId,
    targetType,
    targetId,
    fileName,
    relativePath,
    thumbRel,
    src.file_size_bytes,
    src.mime_type,
    now,
  );
  return assetId;
}

/** 已下载副本若缺封面或封面文件丢失，从源作品再克隆一份 */
async function ensureLocalCoverFromSource(
  db: Database,
  userId: string,
  workType: DownloadWorkType,
  localWorkId: string,
  sourceWorkId: string,
): Promise<void> {
  const table =
    workType === "character" ? "characters" : workType === "world" ? "worlds" : "stories";
  const local = await db.get<{ cover_asset_id: string | null }>(
    `SELECT cover_asset_id FROM ${table} WHERE id = ? AND author_id = ?`,
    localWorkId,
    userId,
  );
  if (!local) return;

  if (local.cover_asset_id) {
    const owned = await db.get<{ id: string; file_path: string }>(
      "SELECT id, file_path FROM assets WHERE id = ? AND user_id = ?",
      local.cover_asset_id,
      userId,
    );
    if (owned) return;
    // 仍引用他人 asset 且文件可读时，也克隆到本地，保证副本自洽
  }

  const src = await db.get<{ cover_asset_id: string | null }>(
    `SELECT cover_asset_id FROM ${table} WHERE id = ?`,
    sourceWorkId,
  );
  const cloned = await cloneCoverAsset(
    db,
    src?.cover_asset_id ?? local.cover_asset_id,
    userId,
    workType,
    localWorkId,
  );
  if (cloned) {
    await db.run(`UPDATE ${table} SET cover_asset_id = ? WHERE id = ?`, cloned, localWorkId);
  }
}

/**
 * 将市场已发布作品快照为用户本地副本。
 * 积分扣费预留：download_cost 写入流水，本阶段不扣积分。
 */
export async function downloadWorkSnapshot(
  db: Database,
  userId: string,
  workType: DownloadWorkType,
  sourceWorkId: string,
): Promise<SnapshotResult> {
  if (workType === "character") {
    const src = await db.get<Record<string, unknown>>(
      `SELECT * FROM characters WHERE id = ? AND status = 'published'`,
      sourceWorkId,
    );
    if (!src) return { ok: false, msg: "角色不存在或未发布", status: 404 };
    if (String(src.author_id) === userId) {
      return { ok: false, msg: "不能下载自己的作品，请直接在「我的」中使用", status: 400 };
    }
    const version = Number(src.content_version ?? 1) || 1;
    const existing = await db.get<{ local_work_id: string }>(
      `SELECT local_work_id FROM work_downloads
       WHERE user_id = ? AND work_type = ? AND source_work_id = ? AND source_version = ?`,
      userId,
      workType,
      sourceWorkId,
      version,
    );
    if (existing) {
      await ensureLocalCoverFromSource(
        db,
        userId,
        "character",
        existing.local_work_id,
        sourceWorkId,
      );
      return {
        ok: true,
        localWorkId: existing.local_work_id,
        alreadyHad: true,
        sourceVersion: version,
      };
    }

    const localId = id("char");
    const now = nowIso();
    const coverAssetId = await cloneCoverAsset(
      db,
      src.cover_asset_id as string | null,
      userId,
      "character",
      localId,
    );
    await db.run(
      `INSERT INTO characters (
        id, author_id, name, avatar_url, cover_asset_id, summary, personality,
        appearance, background, speech_style, likes_dislikes, greeting,
        tags_json, draft_json, status, like_count, favorite_count,
        content_version, download_cost, source_work_id, source_version,
        is_derivative, derivative_declared, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'draft', 0, 0, 1, 0, ?, ?, 1, 0, ?, ?)`,
      localId,
      userId,
      src.name,
      src.avatar_url ?? null,
      coverAssetId,
      src.summary ?? "",
      src.personality ?? "",
      src.appearance ?? "",
      src.background ?? "",
      src.speech_style ?? "",
      src.likes_dislikes ?? "",
      src.greeting ?? "",
      src.tags_json ?? "[]",
      sourceWorkId,
      version,
      now,
      now,
    );
    await db.run(
      `INSERT INTO work_downloads
       (id, user_id, work_type, source_work_id, local_work_id, source_version, cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id("dl"),
      userId,
      workType,
      sourceWorkId,
      localId,
      version,
      Number(src.download_cost ?? 0) || 0,
      now,
    );
    return { ok: true, localWorkId: localId, alreadyHad: false, sourceVersion: version };
  }

  if (workType === "world") {
    const src = await db.get<Record<string, unknown>>(
      `SELECT * FROM worlds WHERE id = ? AND status = 'published'`,
      sourceWorkId,
    );
    if (!src) return { ok: false, msg: "世界不存在或未发布", status: 404 };
    if (String(src.author_id) === userId) {
      return { ok: false, msg: "不能下载自己的作品，请直接在「我的」中使用", status: 400 };
    }
    const version = Number(src.content_version ?? 1) || 1;
    const existing = await db.get<{ local_work_id: string }>(
      `SELECT local_work_id FROM work_downloads
       WHERE user_id = ? AND work_type = ? AND source_work_id = ? AND source_version = ?`,
      userId,
      workType,
      sourceWorkId,
      version,
    );
    if (existing) {
      await ensureLocalCoverFromSource(
        db,
        userId,
        "world",
        existing.local_work_id,
        sourceWorkId,
      );
      return {
        ok: true,
        localWorkId: existing.local_work_id,
        alreadyHad: true,
        sourceVersion: version,
      };
    }

    const localId = id("world");
    const now = nowIso();
    const coverAssetId = await cloneCoverAsset(
      db,
      src.cover_asset_id as string | null,
      userId,
      "world",
      localId,
    );
    await db.run(
      `INSERT INTO worlds (
        id, author_id, name, cover_asset_id, summary, setting_notes, greeting,
        tags_json, draft_json, status, like_count, favorite_count,
        content_version, download_cost, source_work_id, source_version,
        is_derivative, derivative_declared, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'draft', 0, 0, 1, 0, ?, ?, 1, 0, ?, ?)`,
      localId,
      userId,
      src.name,
      coverAssetId,
      src.summary ?? "",
      src.setting_notes ?? "",
      src.greeting ?? "",
      src.tags_json ?? "[]",
      sourceWorkId,
      version,
      now,
      now,
    );

    const entries = await db.all<
      Array<{ title: string; body: string; sort_order: number }>
    >(
      "SELECT title, body, sort_order FROM knowledge_entries WHERE world_id = ? ORDER BY sort_order, id",
      sourceWorkId,
    );
    for (const e of entries) {
      await db.run(
        `INSERT INTO knowledge_entries (id, world_id, title, body, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id("know"),
        localId,
        e.title,
        e.body,
        e.sort_order,
        now,
        now,
      );
    }

    await db.run(
      `INSERT INTO work_downloads
       (id, user_id, work_type, source_work_id, local_work_id, source_version, cost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id("dl"),
      userId,
      workType,
      sourceWorkId,
      localId,
      version,
      Number(src.download_cost ?? 0) || 0,
      now,
    );
    return { ok: true, localWorkId: localId, alreadyHad: false, sourceVersion: version };
  }

  // story
  const src = await db.get<Record<string, unknown>>(
    `SELECT * FROM stories WHERE id = ? AND status = 'published'`,
    sourceWorkId,
  );
  if (!src) return { ok: false, msg: "故事不存在或未发布", status: 404 };
  if (String(src.author_id) === userId) {
    return { ok: false, msg: "不能下载自己的作品，请直接在「我的」中使用", status: 400 };
  }
  const version = Number(src.content_version ?? 1) || 1;
  const existing = await db.get<{ local_work_id: string }>(
    `SELECT local_work_id FROM work_downloads
     WHERE user_id = ? AND work_type = ? AND source_work_id = ? AND source_version = ?`,
    userId,
    workType,
    sourceWorkId,
    version,
  );
  if (existing) {
    await ensureLocalCoverFromSource(db, userId, "story", existing.local_work_id, sourceWorkId);
    return {
      ok: true,
      localWorkId: existing.local_work_id,
      alreadyHad: true,
      sourceVersion: version,
    };
  }

  const localId = id("story");
  const now = nowIso();
  const coverAssetId = await cloneCoverAsset(
    db,
    src.cover_asset_id as string | null,
    userId,
    "story",
    localId,
  );
  await db.run(
    `INSERT INTO stories (
      id, author_id, title, summary, cover_asset_id, greeting, tags_json, draft_json,
      status, like_count, favorite_count, content_version, download_cost,
      source_work_id, source_version, is_derivative, derivative_declared, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'draft', 0, 0, 1, 0, ?, ?, 1, 0, ?, ?)`,
    localId,
    userId,
    src.title,
    src.summary ?? "",
    coverAssetId,
    src.greeting ?? "",
    src.tags_json ?? "[]",
    sourceWorkId,
    version,
    now,
    now,
  );

  // 复制大纲节点（扁平复制，保留 parent 映射）
  const nodes = await db.all<
    Array<{
      id: string;
      parent_id: string | null;
      title: string;
      type: string;
      sort_order: number;
      content: string;
    }>
  >(
    "SELECT id, parent_id, title, type, sort_order, content FROM story_outline_nodes WHERE story_id = ?",
    sourceWorkId,
  );
  const idMap = new Map<string, string>();
  for (const n of nodes) idMap.set(n.id, id("outline"));
  for (const n of nodes) {
    await db.run(
      `INSERT INTO story_outline_nodes
       (id, story_id, parent_id, title, type, sort_order, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      idMap.get(n.id),
      localId,
      n.parent_id ? idMap.get(n.parent_id) ?? null : null,
      n.title,
      n.type,
      n.sort_order,
      n.content ?? "",
      now,
      now,
    );
  }

  // 引入关系：指向原角色/世界 ID（体验仍可引用已发布或作者可见的卡）；本地下载角色可另议
  const storyChars = await db.all<Array<{ character_id: string; is_custom: number }>>(
    "SELECT character_id, is_custom FROM story_characters WHERE story_id = ?",
    sourceWorkId,
  );
  for (const sc of storyChars) {
    await db.run(
      "INSERT INTO story_characters (story_id, character_id, is_custom, created_at) VALUES (?, ?, ?, ?)",
      localId,
      sc.character_id,
      sc.is_custom,
      now,
    );
  }
  const storyWorlds = await db.all<Array<{ world_id: string }>>(
    "SELECT world_id FROM story_worlds WHERE story_id = ?",
    sourceWorkId,
  );
  for (const sw of storyWorlds) {
    await db.run(
      "INSERT INTO story_worlds (story_id, world_id, created_at) VALUES (?, ?, ?)",
      localId,
      sw.world_id,
      now,
    );
  }

  await db.run(
    `INSERT INTO work_downloads
     (id, user_id, work_type, source_work_id, local_work_id, source_version, cost, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id("dl"),
    userId,
    workType,
    sourceWorkId,
    localId,
    version,
    Number(src.download_cost ?? 0) || 0,
    now,
  );
  return { ok: true, localWorkId: localId, alreadyHad: false, sourceVersion: version };
}

/** 上架前：若为下载衍生副本，必须声明衍生，否则禁止发布 */
export async function assertPublishAllowedForDerivative(
  db: Database,
  table: "characters" | "worlds" | "stories",
  workId: string,
  body?: { declare_derivative?: boolean },
): Promise<{ ok: true } | { ok: false; msg: string }> {
  const row = await db.get<{
    source_work_id: string | null;
    is_derivative: number;
    derivative_declared: number;
  }>(
    `SELECT source_work_id, is_derivative, derivative_declared FROM ${table} WHERE id = ?`,
    workId,
  );
  if (!row) return { ok: false, msg: "作品不存在" };
  const isCopy = Boolean(row.source_work_id) || Number(row.is_derivative) === 1;
  if (!isCopy) return { ok: true };

  if (body?.declare_derivative || Number(row.derivative_declared) === 1) {
    if (Number(row.derivative_declared) !== 1) {
      await db.run(
        `UPDATE ${table} SET is_derivative = 1, derivative_declared = 1 WHERE id = ?`,
        workId,
      );
    }
    return { ok: true };
  }
  return {
    ok: false,
    msg: "该作品来自市场下载副本，上架前须声明为衍生作品（declare_derivative=true），禁止未授权拷贝冒充原创",
  };
}
