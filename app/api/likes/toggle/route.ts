import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const schema = z.object({
  target_type: z.enum(["story", "character", "world"]).default("story"),
  target_id: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  const db = await getDb();
  const existing = await db.get<{ id: string }>(
    "SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?",
    userId,
    parsed.data.target_type,
    parsed.data.target_id,
  );

  if (existing) {
    await db.run("DELETE FROM likes WHERE id = ?", existing.id);
    return NextResponse.json({ code: 200, msg: "已取消点赞", data: { liked: false } });
  }

  await db.run(
    "INSERT INTO likes (id, user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?)",
    id("like"),
    userId,
    parsed.data.target_type,
    parsed.data.target_id,
    nowIso(),
  );
  return NextResponse.json({ code: 200, msg: "点赞成功", data: { liked: true } });
}
