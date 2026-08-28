import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { CREDIT_COSTS, InsufficientCreditsError, refundCredits, spendCredits } from "@/lib/credits";
import { generateSceneImage } from "@/lib/image-generator";
import { resolvePlatformMediaConfig } from "@/lib/image-model";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const rl = rateLimitAllow(`chat_image:${userId}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { code: 429, msg: `生成图片过于频繁，请约 ${Math.ceil(rl.retryAfterMs / 1000)} 秒后再试` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }
  const rlIp = rateLimitAllow(`chat_image_ip:${getRequestIp(req)}`, 20, 60_000);
  if (!rlIp.ok) {
    return NextResponse.json(
      { code: 429, msg: "当前网络请求过于频繁，请稍后再试" },
      { status: 429 },
    );
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
    session_id: string;
  }>(
    `SELECT m.id, m.role, m.content, m.session_id
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
    return NextResponse.json({ code: 400, msg: "只能为 AI 回复生成配图" }, { status: 400 });
  }
  if (!row.content.trim()) {
    return NextResponse.json({ code: 400, msg: "这条回复没有可生成配图的内容" }, { status: 400 });
  }

  try {
    await spendCredits({
      userId,
      reason: "image",
      refType: "chat_message",
      refId: row.id,
    });
    const result = await generateSceneImage({
      userId,
      messageId: row.id,
      replyContent: row.content,
      config,
    });
    return NextResponse.json({ code: 200, data: result });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { code: 402, msg: err.message, data: { need: err.need, balance: err.balance } },
        { status: 402 },
      );
    }
    await refundCredits({
      userId,
      reason: "refund_image",
      amount: CREDIT_COSTS.image,
      refType: "chat_message",
      refId: row.id,
      note: err instanceof Error ? err.message : "生成图片失败",
    });
    const msg = err instanceof Error ? err.message : "生成图片失败";
    return NextResponse.json({ code: 500, msg }, { status: 500 });
  }
}
