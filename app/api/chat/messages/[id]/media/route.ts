import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { removeChatMessageMedia } from "@/lib/chat-media";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "image" && kind !== "video") {
    return NextResponse.json({ code: 400, msg: "kind 须为 image 或 video" }, { status: 400 });
  }

  const result = await removeChatMessageMedia({ userId, messageId, kind });
  if (!result.ok) {
    return NextResponse.json({ code: result.status, msg: result.msg }, { status: result.status });
  }
  return NextResponse.json({ code: 200, msg: kind === "image" ? "已删除配图" : "已删除视频" });
}
