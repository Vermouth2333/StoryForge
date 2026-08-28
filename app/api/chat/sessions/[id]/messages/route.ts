import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { enqueueVideoJob, recoverStaleVideoJob } from "@/lib/video-jobs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const db = await getDb();
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(100, Number(url.searchParams.get("page_size") ?? "50"));
  const offset = (Math.max(page, 1) - 1) * pageSize;

  const session = await db.get<{ id: string }>(
    "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
    id,
    userId,
  );

  if (!session) {
    return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
  }

  const rows = await db.all<{
    id: string;
    role: string;
    content: string;
    token_input: number;
    token_output: number;
    latency_ms: number;
    model_name: string;
    created_at: string;
    image_asset_id: string | null;
    video_asset_id: string | null;
    video_status: string | null;
    video_error: string | null;
    video_request_id: string | null;
  }[]>(
    `SELECT id, role, content, token_input, token_output, latency_ms, model_name, created_at,
            image_asset_id, video_asset_id, video_status, video_error, video_request_id
     FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`,
    id,
    pageSize,
    offset,
  );

  if (userId) {
    for (const row of rows) {
      if (row.video_status === "generating") {
        await recoverStaleVideoJob(row.id, userId);
        const fresh = await db.get<{ video_status: string | null }>(
          "SELECT video_status FROM chat_messages WHERE id = ?",
          row.id,
        );
        if (fresh?.video_status === "generating") {
          enqueueVideoJob({
            userId,
            messageId: row.id,
            replyContent: row.content,
            existingRequestId: row.video_request_id,
          });
        }
      }
    }
  }

  const data = [];
  for (const row of rows) {
    const live = await db.get<{
      video_status: string | null;
      video_asset_id: string | null;
      video_error: string | null;
    }>(
      "SELECT video_status, video_asset_id, video_error FROM chat_messages WHERE id = ?",
      row.id,
    );
    data.push({
      ...row,
      video_status: live?.video_status ?? row.video_status,
      video_error: live?.video_error ?? row.video_error,
      image_url: row.image_asset_id ? `/api/assets/${row.image_asset_id}/file` : null,
      video_url: (live?.video_asset_id ?? row.video_asset_id)
        ? `/api/assets/${live?.video_asset_id ?? row.video_asset_id}/file`
        : null,
    });
  }

  return NextResponse.json({ code: 200, data, msg: "ok" });
}
