import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

const schema = z.object({
  title: z.string().min(1).max(120).optional(),
  summary: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = await getDb();
  const story = await db.get<{
    id: string;
    author_id: string;
    author_display: string;
    title: string;
    summary: string;
    status: string;
    tags_json: string;
    like_count: number;
    favorite_count: number;
    publish_at: string | null;
    updated_at: string;
  }>(
    `SELECT s.id, s.author_id,
      CASE WHEN u.status = 'deleted' THEN '已注销用户' ELSE COALESCE(u.username, u.id) END AS author_display,
      s.title, s.summary, s.status, s.tags_json, s.like_count, s.favorite_count, s.publish_at, s.updated_at
     FROM stories s
     LEFT JOIN users u ON u.id = s.author_id
     WHERE s.id = ?`,
    id,
  );
  if (!story) {
    return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
  }
  const userId = await getCurrentUserId();
  let likedByMe = false;
  let favoritedByMe = false;
  let isFollowing = false;
  if (userId) {
    const likeRow = await db.get<{ id: string }>(
      "SELECT id FROM likes WHERE user_id = ? AND target_type = 'story' AND target_id = ?",
      userId,
      id,
    );
    likedByMe = Boolean(likeRow);
    const favRow = await db.get<{ id: string }>(
      "SELECT id FROM favorites WHERE user_id = ? AND target_type = 'story' AND target_id = ?",
      userId,
      id,
    );
    favoritedByMe = Boolean(favRow);
    if (story.author_id !== userId) {
      const followRow = await db.get<{ id: string }>(
        "SELECT id FROM follows WHERE user_id = ? AND author_id = ?",
        userId,
        story.author_id,
      );
      isFollowing = Boolean(followRow);
    }
  }
  return NextResponse.json({
    code: 200,
    data: { ...story, liked_by_me: likedByMe, favorited_by_me: favoritedByMe, is_following: isFollowing },
    msg: "ok",
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const story = await db.get<{ id: string }>(
    "SELECT id FROM stories WHERE id = ? AND author_id = ?",
    id,
    userId,
  );
  if (!story) {
    return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.title !== undefined) {
    fields.push("title = ?");
    values.push(parsed.data.title);
  }
  if (parsed.data.summary !== undefined) {
    fields.push("summary = ?");
    values.push(parsed.data.summary);
  }
  if (parsed.data.tags !== undefined) {
    fields.push("tags_json = ?");
    values.push(JSON.stringify(parsed.data.tags));
  }
  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(id);

  await db.run(`UPDATE stories SET ${fields.join(", ")} WHERE id = ?`, ...values);
  return NextResponse.json({ code: 200, msg: "更新成功" });
}
