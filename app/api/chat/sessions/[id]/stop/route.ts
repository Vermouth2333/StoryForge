import { NextResponse } from "next/server";
import { requestStop } from "@/lib/chat-state";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  requestStop(id);
  return NextResponse.json({ code: 200, msg: "已停止生成" });
}
