import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const db = await getDb();

  const story = await db.get<{ id: string; title: string }>(
    "SELECT id, title FROM stories WHERE id = ? AND author_id = ?",
    id,
    userId,
  );
  if (!story) {
    return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
  }

  if (story.title.includes("违禁")) {
    return NextResponse.json(
      { code: 400, msg: "基础安全过滤未通过，请调整标题后重试" },
      { status: 400 },
    );
  }

  const now = nowIso();
  await db.run(
    "UPDATE stories SET status = 'published', publish_at = ?, updated_at = ? WHERE id = ?",
    now,
    now,
    id,
  );

  const followers = await db.all<{ user_id: string }[]>(
    "SELECT user_id FROM follows WHERE author_id = ?",
    userId,
  );
  for (const row of followers) {
    await createNotification(db, row.user_id, "author_update", {
      author_id: userId,
      story_id: id,
      story_title: story.title,
    });
  }

  return NextResponse.json({ code: 200, msg: "发布成功", data: { publish_at: now } });
}
