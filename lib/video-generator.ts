import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { deleteOwnedChatAsset } from "@/lib/chat-media";
import { getDb, id, nowIso } from "@/lib/db";
import type { ImageModelConfig } from "@/lib/image-model";
import { saveRawMediaFile } from "@/lib/media-storage";
import { concatMp4Clips, extractLastFrameJpeg } from "@/lib/video-concat";
import {
  VIDEO_NEGATIVE_PROMPT,
  buildIllustrationI2vPrompt,
  buildIllustrationT2vPrompt,
  splitSceneBeats,
} from "@/lib/scene-style";

const POLL_MS = 8_000;
const MAX_POLLS_PER_CLIP = 90;

function resolveUnderStorage(rel: string): string | null {
  const storageRoot = path.resolve(process.cwd(), "storage");
  const abs = path.resolve(storageRoot, rel);
  const relative = path.relative(storageRoot, abs);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return abs;
}

function imageSizeForAspect(width: number, height: number): "1280x720" | "720x1280" | "960x960" {
  const ratio = width / Math.max(height, 1);
  if (ratio > 1.25) return "1280x720";
  if (ratio < 0.8) return "720x1280";
  return "960x960";
}

type JpegRef = {
  dataUrl: string;
  imageSize: "1280x720" | "720x1280" | "960x960";
};

class VideoJobDiscardedError extends Error {
  constructor() {
    super("video job discarded");
    this.name = "VideoJobDiscardedError";
  }
}

async function bufferToJpegRef(buf: Buffer, maxEdge = 960): Promise<JpegRef> {
  const jpeg = await sharp(buf)
    .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const meta = await sharp(jpeg).metadata();
  const width = meta.width ?? 960;
  const height = meta.height ?? 960;
  return {
    dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    imageSize: imageSizeForAspect(width, height),
  };
}

async function assetIdToJpegDataUrl(assetId: string): Promise<JpegRef | null> {
  const db = await getDb();
  const asset = await db.get<{ file_path: string; mime_type: string | null }>(
    "SELECT file_path, mime_type FROM assets WHERE id = ?",
    assetId,
  );
  if (!asset?.file_path) return null;
  if ((asset.mime_type ?? "").startsWith("video/")) return null;

  const abs = resolveUnderStorage(asset.file_path);
  if (!abs) return null;

  let buf: Buffer;
  try {
    buf = await readFile(abs);
  } catch {
    return null;
  }

  try {
    return await bufferToJpegRef(buf);
  } catch {
    return null;
  }
}

async function resolveVideoReferenceImage(messageId: string) {
  const db = await getDb();
  const msg = await db.get<{
    image_asset_id: string | null;
    session_id: string;
    created_at: string;
    story_id: string | null;
    character_id: string | null;
    world_id: string | null;
  }>(
    `SELECT m.image_asset_id, m.session_id, m.created_at, s.story_id, s.character_id, s.world_id
     FROM chat_messages m
     INNER JOIN chat_sessions s ON s.id = m.session_id
     WHERE m.id = ?`,
    messageId,
  );
  if (!msg) return null;

  const candidates: string[] = [];
  const sameMessage = (msg.image_asset_id ?? "").trim();
  if (sameMessage) candidates.push(sameMessage);

  const sessionImg = await db.get<{ image_asset_id: string }>(
    `SELECT image_asset_id FROM chat_messages
     WHERE session_id = ?
       AND image_asset_id IS NOT NULL AND TRIM(image_asset_id) != ''
       AND datetime(created_at) <= datetime(?)
     ORDER BY datetime(created_at) DESC
     LIMIT 1`,
    msg.session_id,
    msg.created_at,
  );
  const sessionId = (sessionImg?.image_asset_id ?? "").trim();
  if (sessionId && !candidates.includes(sessionId)) candidates.push(sessionId);

  let coverId: string | null = null;
  if (msg.story_id) {
    const row = await db.get<{ cover_asset_id: string | null }>(
      "SELECT cover_asset_id FROM stories WHERE id = ?",
      msg.story_id,
    );
    coverId = row?.cover_asset_id ?? null;
  } else if (msg.character_id) {
    const row = await db.get<{ cover_asset_id: string | null }>(
      "SELECT cover_asset_id FROM characters WHERE id = ?",
      msg.character_id,
    );
    coverId = row?.cover_asset_id ?? null;
  } else if (msg.world_id) {
    const row = await db.get<{ cover_asset_id: string | null }>(
      "SELECT cover_asset_id FROM worlds WHERE id = ?",
      msg.world_id,
    );
    coverId = row?.cover_asset_id ?? null;
  }
  const cover = (coverId ?? "").trim();
  if (cover && !candidates.includes(cover)) candidates.push(cover);

  for (const assetId of candidates) {
    const converted = await assetIdToJpegDataUrl(assetId);
    if (converted) return converted;
  }
  return null;
}

function joinRequestIds(ids: string[]): string {
  return ids.filter(Boolean).join(",");
}

function parseRequestIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function seedFromMessageId(messageId: string): number {
  let h = 2166136261;
  for (let i = 0; i < messageId.length; i++) {
    h ^= messageId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483647;
}

async function persistRequestIds(messageId: string, ids: string[]): Promise<string | null> {
  const key = joinRequestIds(ids);
  const db = await getDb();
  const result = await db.run(
    "UPDATE chat_messages SET video_request_id = ? WHERE id = ? AND video_status = 'generating'",
    key,
    messageId,
  );
  if ((result.changes ?? 0) === 0) return null;
  return key;
}

type VideoStatusPayload = {
  status?: string;
  reason?: string;
  data?: {
    status?: string;
    reason?: string;
    results?: { videos?: Array<{ url?: string }> };
  };
  results?: { videos?: Array<{ url?: string }> };
};

async function fetchVideoStatus(args: {
  config: ImageModelConfig;
  requestId: string;
}): Promise<{ status: string; url: string; reason: string }> {
  const statusRes = await fetch(`${args.config.baseUrl}/video/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.config.apiKey}`,
    },
    body: JSON.stringify({ requestId: args.requestId }),
  });
  if (!statusRes.ok) {
    const detail = await statusRes.text().catch(() => "");
    throw new Error(`查询视频状态失败 ${statusRes.status}${detail ? `：${detail.slice(0, 200)}` : ""}`);
  }
  const statusJson = (await statusRes.json()) as VideoStatusPayload;
  const payload = statusJson.data ?? statusJson;
  const status = String(payload.status ?? "").trim();
  const url = payload.results?.videos?.[0]?.url ?? statusJson.results?.videos?.[0]?.url ?? "";
  const reason = payload.reason || statusJson.reason || "";
  return { status, url, reason };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function videoJobStillActive(messageId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<{ video_status: string | null }>(
    "SELECT video_status FROM chat_messages WHERE id = ?",
    messageId,
  );
  return row?.video_status === "generating";
}

async function assertVideoJobActive(messageId: string) {
  if (!(await videoJobStillActive(messageId))) {
    throw new VideoJobDiscardedError();
  }
}

async function submitVideoClip(args: {
  config: ImageModelConfig;
  promptI2v: string;
  promptT2v: string;
  imageSize: JpegRef["imageSize"];
  ref: JpegRef | null;
  seed: number;
}): Promise<string> {
  const trySubmit = async (body: Record<string, unknown>) => {
    const submitRes = await fetch(`${args.config.baseUrl}/video/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!submitRes.ok) {
      const detail = await submitRes.text().catch(() => "");
      throw new Error(`视频提交失败 ${submitRes.status}${detail ? `：${detail.slice(0, 240)}` : ""}`);
    }
    const submitted = (await submitRes.json()) as { requestId?: string; request_id?: string };
    const requestId = submitted.requestId ?? submitted.request_id ?? "";
    if (!requestId) throw new Error("视频服务未返回 requestId");
    return requestId;
  };

  if (args.ref) {
    try {
      return await trySubmit({
        model: args.config.videoI2vModelName,
        prompt: args.promptI2v,
        image_size: args.imageSize,
        image: args.ref.dataUrl,
        negative_prompt: VIDEO_NEGATIVE_PROMPT,
        seed: args.seed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[video] I2V 提交失败，回退文生视频", msg);
    }
  }

  return trySubmit({
    model: args.config.videoModelName,
    prompt: args.promptT2v,
    image_size: args.imageSize,
    negative_prompt: VIDEO_NEGATIVE_PROMPT,
    seed: args.seed,
  });
}

async function pollClipUntilReady(args: {
  config: ImageModelConfig;
  requestId: string;
  messageId: string;
}): Promise<string | null> {
  let lastStatus = "InQueue";
  for (let i = 0; i < MAX_POLLS_PER_CLIP; i++) {
    await sleep(POLL_MS);
    await assertVideoJobActive(args.messageId);
    const result = await fetchVideoStatus({ config: args.config, requestId: args.requestId });
    lastStatus = result.status || lastStatus;
    const status = result.status.toLowerCase();
    if (status === "failed") {
      console.error("[video] 片段失败", args.requestId, result.reason);
      return null;
    }
    if (status === "succeed" && result.url) return result.url;
  }
  throw new Error(`视频生成超时（最后状态：${lastStatus || "未知"}），请稍后重试`);
}

async function downloadClip(videoUrl: string): Promise<Buffer> {
  const fileRes = await fetch(videoUrl);
  if (!fileRes.ok) throw new Error(`下载视频失败（${fileRes.status}）`);
  return Buffer.from(await fileRes.arrayBuffer());
}

async function lastFrameRef(clip: Buffer): Promise<JpegRef | null> {
  const frame = await extractLastFrameJpeg(clip);
  if (!frame) return null;
  try {
    return await bufferToJpegRef(frame, 1280);
  } catch (err) {
    console.error("[video] 末帧转 JPEG 失败", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function generateSceneVideo(args: {
  userId: string;
  messageId: string;
  replyContent: string;
  config: ImageModelConfig;
  existingRequestId?: string | null;
}): Promise<{ assetId: string; videoUrl: string } | { discarded: true }> {
  try {
    return await generateSceneVideoInner(args);
  } catch (err) {
    if (err instanceof VideoJobDiscardedError) return { discarded: true };
    throw err;
  }
}

async function generateSceneVideoInner(args: {
  userId: string;
  messageId: string;
  replyContent: string;
  config: ImageModelConfig;
  existingRequestId?: string | null;
}): Promise<{ assetId: string; videoUrl: string } | { discarded: true }> {
  const db = await getDb();
  const beats = splitSceneBeats(args.replyContent);
  const storyArc = args.replyContent.replace(/\s+/g, " ").trim().slice(0, 180);
  const seed = seedFromMessageId(args.messageId);
  const openingRef = await resolveVideoReferenceImage(args.messageId);
  const imageSize = openingRef?.imageSize ?? "960x960";

  const stored = await db.get<{ video_request_id: string | null }>(
    "SELECT video_request_id FROM chat_messages WHERE id = ?",
    args.messageId,
  );
  const fromDb = parseRequestIds(stored?.video_request_id ?? "");
  const fromArg = parseRequestIds(args.existingRequestId ?? "");
  let requestIds = fromDb.length >= fromArg.length ? fromDb : fromArg;
  let requestKey = joinRequestIds(requestIds);
  const clips: Buffer[] = [];
  let currentRef: JpegRef | null = openingRef;

  const adoptClip = async (buf: Buffer) => {
    clips.push(buf);
    const next = await lastFrameRef(buf);
    if (next) {
      currentRef = { dataUrl: next.dataUrl, imageSize };
    }
  };

  for (const clipId of requestIds) {
    await assertVideoJobActive(args.messageId);
    const url = await pollClipUntilReady({
      config: args.config,
      requestId: clipId,
      messageId: args.messageId,
    });
    if (!url) continue;
    await adoptClip(await downloadClip(url));
  }

  for (let i = requestIds.length; i < beats.length; i++) {
    await assertVideoJobActive(args.messageId);
    const clipId = await submitVideoClip({
      config: args.config,
      promptI2v: buildIllustrationI2vPrompt(beats[i], i, beats.length, storyArc),
      promptT2v: buildIllustrationT2vPrompt(beats[i], i, beats.length, storyArc),
      imageSize,
      ref: currentRef,
      seed,
    });
    requestIds = [...requestIds, clipId];
    const persisted = await persistRequestIds(args.messageId, requestIds);
    if (!persisted) throw new VideoJobDiscardedError();
    requestKey = persisted;

    const url = await pollClipUntilReady({
      config: args.config,
      requestId: clipId,
      messageId: args.messageId,
    });
    if (!url) continue;
    await adoptClip(await downloadClip(url));
  }

  if (clips.length === 0) {
    await assertVideoJobActive(args.messageId);
    throw new Error("视频生成失败");
  }

  await assertVideoJobActive(args.messageId);

  const buffer = await concatMp4Clips(clips);
  const assetId = id("asset");
  const saved = await saveRawMediaFile({
    userId: args.userId,
    assetId,
    buffer,
    fileName: `video_${assetId}.mp4`,
  });

  const now = nowIso();
  await db.run(
    `INSERT INTO assets (id, user_id, asset_type, target_type, target_id, file_name, file_path, thumbnail_path, file_size_bytes, mime_type, created_at)
     VALUES (?, ?, 'video', 'chat_message', ?, ?, ?, NULL, ?, ?, ?)`,
    assetId,
    args.userId,
    args.messageId,
    `video_${assetId}.mp4`,
    saved.relativePath,
    saved.fileSize,
    "video/mp4",
    now,
  );
  const attached = await db.run(
    `UPDATE chat_messages
     SET video_asset_id = ?, video_status = 'ready', video_error = NULL
     WHERE id = ? AND video_status = 'generating' AND video_request_id = ?`,
    assetId,
    args.messageId,
    requestKey,
  );
  if ((attached.changes ?? 0) === 0) {
    await deleteOwnedChatAsset(db, assetId, args.userId);
    return { discarded: true };
  }

  return { assetId, videoUrl: `/api/assets/${assetId}/file` };
}
