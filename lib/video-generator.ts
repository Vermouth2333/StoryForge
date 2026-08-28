import { deleteOwnedChatAsset } from "@/lib/chat-media";
import { getDb, id, nowIso } from "@/lib/db";
import type { ImageModelConfig } from "@/lib/image-model";
import { saveRawMediaFile } from "@/lib/media-storage";

const POLL_MS = 5000;
const MAX_POLLS = 50;

function buildVideoPrompt(reply: string) {
  const cleaned = reply.replace(/\s+/g, " ").trim().slice(0, 500);
  return `电影感短视频，运镜流畅，不要字幕、水印或台标。场景：${cleaned}`;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function videoJobStillActive(messageId: string, requestId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<{ video_status: string | null; video_request_id: string | null }>(
    "SELECT video_status, video_request_id FROM chat_messages WHERE id = ?",
    messageId,
  );
  return row?.video_status === "generating" && row?.video_request_id === requestId;
}

export async function generateSceneVideo(args: {
  userId: string;
  messageId: string;
  replyContent: string;
  config: ImageModelConfig;
  existingRequestId?: string | null;
}): Promise<{ assetId: string; videoUrl: string } | { discarded: true }> {
  const db = await getDb();
  let requestId = (args.existingRequestId ?? "").trim();
  if (!requestId) {
    const prompt = buildVideoPrompt(args.replyContent);
    const submitRes = await fetch(`${args.config.baseUrl}/video/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.config.apiKey}`,
      },
      body: JSON.stringify({
        model: args.config.videoModelName,
        prompt,
        image_size: "1280x720",
      }),
    });
    if (!submitRes.ok) {
      const detail = await submitRes.text().catch(() => "");
      throw new Error(`视频提交失败 ${submitRes.status}${detail ? `：${detail.slice(0, 240)}` : ""}`);
    }
    const submitted = (await submitRes.json()) as { requestId?: string; request_id?: string };
    requestId = submitted.requestId ?? submitted.request_id ?? "";
    if (!requestId) throw new Error("视频服务未返回 requestId");
    await db.run(
      "UPDATE chat_messages SET video_request_id = ? WHERE id = ? AND video_status = 'generating'",
      requestId,
      args.messageId,
    );
  }

  let videoUrl = "";
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    if (!(await videoJobStillActive(args.messageId, requestId))) {
      return { discarded: true };
    }
    const statusRes = await fetch(`${args.config.baseUrl}/video/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.config.apiKey}`,
      },
      body: JSON.stringify({ requestId }),
    });
    if (!statusRes.ok) {
      const detail = await statusRes.text().catch(() => "");
      throw new Error(`查询视频状态失败 ${statusRes.status}${detail ? `：${detail.slice(0, 200)}` : ""}`);
    }
    const statusJson = (await statusRes.json()) as {
      status?: string;
      reason?: string;
      results?: { videos?: Array<{ url?: string }> };
    };
    if (statusJson.status === "Failed") {
      throw new Error(statusJson.reason || "视频生成失败");
    }
    if (statusJson.status === "Succeed") {
      videoUrl = statusJson.results?.videos?.[0]?.url ?? "";
      break;
    }
  }
  if (!videoUrl) {
    if (!(await videoJobStillActive(args.messageId, requestId))) {
      return { discarded: true };
    }
    throw new Error("视频生成超时，请稍后重试");
  }

  if (!(await videoJobStillActive(args.messageId, requestId))) {
    return { discarded: true };
  }

  const fileRes = await fetch(videoUrl);
  if (!fileRes.ok) throw new Error(`下载视频失败（${fileRes.status}）`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
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
    requestId,
  );
  if ((attached.changes ?? 0) === 0) {
    await deleteOwnedChatAsset(db, assetId, args.userId);
    return { discarded: true };
  }

  return { assetId, videoUrl: `/api/assets/${assetId}/file` };
}
