import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listSessionMedia } from "@/lib/session-media-zip";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const db = await getDb();
  const session = await db.get<{ id: string }>(
    "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
    sessionId,
    userId,
  );
  if (!session) {
    return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
  }

  const files = await listSessionMedia(db, sessionId, "all");
  const toItem = (row: (typeof files)[number]) => ({
    asset_id: row.assetId,
    message_id: row.messageId,
    file_name: row.fileName,
    mime_type: row.mimeType,
    url: `/api/assets/${row.assetId}/file`,
  });

  return NextResponse.json({
    code: 200,
    data: {
      images: files.filter((f) => f.kind === "image").map(toItem),
      videos: files.filter((f) => f.kind === "video").map(toItem),
    },
  });
}
