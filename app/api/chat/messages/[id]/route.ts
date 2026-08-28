import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { scanTextBundle } from "@/lib/content-filter";
import { getDb } from "@/lib/db";

const schema = z.object({
  content: z.string().min(1, "内容不能为空").max(20000, "内容过长"),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: 400, msg: parsed.error.issues[0]?.message ?? "参数错误" },
      { status: 400 },
    );
  }

  const scan = scanTextBundle([parsed.data.content], 20_000);
  if (!scan.ok) {
    return NextResponse.json({ code: 400, msg: scan.msg }, { status: 400 });
  }

  const db = await getDb();
  const row = await db.get<{ id: string; role: string }>(
    `SELECT m.id, m.role
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
    return NextResponse.json({ code: 400, msg: "只能编辑 AI 回复" }, { status: 400 });
  }

  await db.run("UPDATE chat_messages SET content = ? WHERE id = ?", parsed.data.content, row.id);
  return NextResponse.json({
    code: 200,
    data: { id: row.id, content: parsed.data.content },
    msg: "已保存",
  });
}
