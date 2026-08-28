import { getDb, nowIso } from "@/lib/db";
import { CREDIT_COSTS, refundCredits } from "@/lib/credits";
import { resolvePlatformMediaConfig } from "@/lib/image-model";
import { generateSceneVideo } from "@/lib/video-generator";

const inflight = new Set<string>();
const STALE_MS = 12 * 60 * 1000;

export async function recoverStaleVideoJob(messageId: string, userId: string) {
  const db = await getDb();
  const row = await db.get<{
    video_status: string | null;
    video_started_at: string | null;
  }>("SELECT video_status, video_started_at FROM chat_messages WHERE id = ?", messageId);
  if (row?.video_status !== "generating") return;
  const started = row.video_started_at ? Date.parse(row.video_started_at) : 0;
  if (started && Date.now() - started < STALE_MS) return;
  if (inflight.has(messageId)) return;
  await failVideoJob(messageId, userId, "视频生成超时，积分已退回");
}

export async function failVideoJob(messageId: string, userId: string, errMsg: string) {
  const db = await getDb();
  const result = await db.run(
    "UPDATE chat_messages SET video_status = 'failed', video_error = ? WHERE id = ? AND video_status = 'generating'",
    errMsg.slice(0, 300),
    messageId,
  );
  if ((result.changes ?? 0) === 0) return;
  await refundCredits({
    userId,
    reason: "refund_video",
    amount: CREDIT_COSTS.video,
    refType: "chat_message",
    refId: messageId,
    note: errMsg.slice(0, 200),
  });
}

export function enqueueVideoJob(args: {
  userId: string;
  messageId: string;
  replyContent: string;
  existingRequestId?: string | null;
}) {
  if (inflight.has(args.messageId)) return;
  inflight.add(args.messageId);
  void (async () => {
    try {
      const config = resolvePlatformMediaConfig();
      if (!config) {
        await failVideoJob(args.messageId, args.userId, "媒体服务暂不可用");
        return;
      }
      await generateSceneVideo({
        userId: args.userId,
        messageId: args.messageId,
        replyContent: args.replyContent,
        config,
        existingRequestId: args.existingRequestId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成视频失败";
      await failVideoJob(args.messageId, args.userId, msg);
    } finally {
      inflight.delete(args.messageId);
    }
  })();
}

export async function markVideoGenerating(messageId: string) {
  const db = await getDb();
  await db.run(
    "UPDATE chat_messages SET video_status = 'generating', video_started_at = ?, video_error = NULL WHERE id = ?",
    nowIso(),
    messageId,
  );
}
