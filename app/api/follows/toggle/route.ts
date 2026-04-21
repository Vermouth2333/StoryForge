import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  author_id: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  const db = await getDb();

  if (parsed.data.author_id === userId) {
    return NextResponse.json({ code: 400, msg: "不能关注自己" }, { status: 400 });
  }

  const existing = await db.get<{ id: string }>(
    "SELECT id FROM follows WHERE user_id = ? AND author_id = ?",
    userId,
    parsed.data.author_id,
  );

  if (existing) {
    await db.run("DELETE FROM follows WHERE id = ?", existing.id);
    return NextResponse.json({ code: 200, msg: "已取消关注", data: { followed: false } });
  }

  const author = await db.get<{ status: string }>("SELECT status FROM users WHERE id = ?", parsed.data.author_id);
  if (!author || author.status === "deleted") {
    return NextResponse.json({ code: 400, msg: "无法关注该作者" }, { status: 400 });
  }

  await db.run(
    "INSERT INTO follows (id, user_id, author_id, created_at) VALUES (?, ?, ?, ?)",
    id("follow"),
    userId,
    parsed.data.author_id,
    nowIso(),
  );
  await createNotification(db, parsed.data.author_id, "followed", {
    actor_user_id: userId,
  });
  return NextResponse.json({ code: 200, msg: "关注成功", data: { followed: true } });
}
