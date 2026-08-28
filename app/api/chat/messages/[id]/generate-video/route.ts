import { after } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CREDIT_COSTS, InsufficientCreditsError, spendCredits } from "@/lib/credits";
import { resolvePlatformMediaConfig } from "@/lib/image-model";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";
import { enqueueVideoJob, markVideoGenerating, recoverStaleVideoJob } from "@/lib/video-jobs";

export const maxDuration = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const db = await getDb();
  const row = await db.get<{
    video_status: string | null;
    video_asset_id: string | null;
    video_error: string | null;
  }>(
    `SELECT m.video_status, m.video_asset_id, m.video_error
     FROM chat_messages m
     INNER JOIN chat_sessions s ON s.id = m.session_id
     WHERE m.id = ? AND s.user_id = ?`,
    messageId,
    userId,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "消息不存在" }, { status: 404 });
  }
  await recoverStaleVideoJob(messageId, userId);
  const fresh = await db.get<{
    video_status: string | null;
    video_asset_id: string | null;
    video_error: string | null;
  }>("SELECT video_status, video_asset_id, video_error FROM chat_messages WHERE id = ?", messageId);
  return NextResponse.json({
    code: 200,
    data: {
      video_status: fresh?.video_status ?? row.video_status,
      video_url: fresh?.video_asset_id ? `/api/assets/${fresh.video_asset_id}/file` : null,
      video_error: fresh?.video_error ?? null,
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const rl = rateLimitAllow(`chat_video:${userId}`, 4, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { code: 429, msg: `生成视频过于频繁，请约 ${Math.ceil(rl.retryAfterMs / 1000)} 秒后再试` },
      { status: 429 },
    );
  }
  const rlIp = rateLimitAllow(`chat_video_ip:${getRequestIp(req)}`, 10, 60_000);
  if (!rlIp.ok) {
    return NextResponse.json({ code: 429, msg: "当前网络请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const config = resolvePlatformMediaConfig();
  if (!config) {
    return NextResponse.json({ code: 503, msg: "媒体服务暂不可用" }, { status: 503 });
  }

  const db = await getDb();
  const row = await db.get<{
    id: string;
    role: string;
    content: string;
    video_status: string | null;
    video_request_id: string | null;
  }>(
    `SELECT m.id, m.role, m.content, m.video_status, m.video_request_id
     FROM chat_messages m
     INNER JOIN chat_sessions s ON s.id = m.session_id
     WHERE m.id = ? AND s.user_id = ?`,
    messageId,
    userId,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "消息不存在" }, { status: 404 });
  }
  if (row.role !== "assistant") {
    return NextResponse.json({ code: 400, msg: "只能为 AI 回复生成视频" }, { status: 400 });
  }
  if (!row.content.trim()) {
    return NextResponse.json({ code: 400, msg: "这条回复没有可生成视频的内容" }, { status: 400 });
  }

  if (row.video_status === "generating") {
    after(() => {
      enqueueVideoJob({
        userId,
        messageId: row.id,
        replyContent: row.content,
        existingRequestId: row.video_request_id,
      });
    });
    return NextResponse.json({
      code: 200,
      data: { status: "generating", cost: CREDIT_COSTS.video },
      msg: "视频仍在生成中，大约还需要 10–20 分钟",
    });
  }

  try {
    await spendCredits({
      userId,
      reason: "video",
      refType: "chat_message",
      refId: row.id,
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { code: 402, msg: err.message, data: { need: err.need, balance: err.balance } },
        { status: 402 },
      );
    }
    throw err;
  }

  await markVideoGenerating(row.id);
  after(() => {
    enqueueVideoJob({
      userId,
      messageId: row.id,
      replyContent: row.content,
    });
  });

  return NextResponse.json({
    code: 200,
    data: { status: "generating", cost: CREDIT_COSTS.video },
    msg: "已开始生成约 30 秒视频，大约需要 10–20 分钟，可离开页面稍后回来",
  });
}
