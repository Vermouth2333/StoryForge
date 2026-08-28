import { processAndSaveCover } from "@/lib/cover-processing";
import { getDb, id, nowIso } from "@/lib/db";
import type { ImageModelConfig } from "@/lib/image-model";

function buildScenePrompt(reply: string) {
  const cleaned = reply.replace(/\s+/g, " ").trim().slice(0, 800);
  return [
    "高质量小说场景插画，电影感光影，精致细节，不要文字、水印、字幕或对话框。",
    `场景内容：${cleaned}`,
  ].join("\n");
}

async function bufferFromImagePayload(item: { url?: string; b64_json?: string }): Promise<Buffer> {
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) {
      throw new Error(`下载生成图片失败（${res.status}）`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("图片模型未返回可用结果");
}

export async function generateSceneImage(args: {
  userId: string;
  messageId: string;
  replyContent: string;
  config: ImageModelConfig;
}): Promise<{ assetId: string; imageUrl: string }> {
  const prompt = buildScenePrompt(args.replyContent);
  const res = await fetch(`${args.config.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.config.apiKey}`,
    },
    body: JSON.stringify({
      model: args.config.modelName,
      prompt,
      image_size: "1024x1024",
      batch_size: 1,
      num_inference_steps: 20,
      guidance_scale: 7.5,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`图片模型返回 ${res.status}${detail ? `：${detail.slice(0, 240)}` : ""}`);
  }

  const json = (await res.json()) as {
    images?: Array<{ url?: string; b64_json?: string }>;
    data?: Array<{ url?: string; b64_json?: string }>;
  };
  const item = json.images?.[0] ?? json.data?.[0];
  if (!item) throw new Error("图片模型未返回图片");

  const buffer = await bufferFromImagePayload(item);
  const assetId = id("asset");
  const processed = await processAndSaveCover({
    userId: args.userId,
    assetId,
    input: buffer,
  });

  const db = await getDb();
  const now = nowIso();
  await db.run(
    `INSERT INTO assets (id, user_id, asset_type, target_type, target_id, file_name, file_path, thumbnail_path, file_size_bytes, mime_type, created_at)
     VALUES (?, ?, 'illustration', 'chat_message', ?, ?, ?, ?, ?, ?, ?)`,
    assetId,
    args.userId,
    args.messageId,
    processed.fileName,
    processed.relativePath,
    processed.relativeThumbPath,
    processed.fileSize,
    processed.mimeType,
    now,
  );
  await db.run("UPDATE chat_messages SET image_asset_id = ? WHERE id = ?", assetId, args.messageId);

  return { assetId, imageUrl: `/api/assets/${assetId}/file` };
}
