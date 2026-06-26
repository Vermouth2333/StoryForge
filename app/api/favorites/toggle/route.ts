import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  target_type: z.enum(["story", "character", "world"]).default("story"),
  target_id: z.string().min(1),
});

async function canFavoriteTarget(
  db: Awaited<ReturnType<typeof getDb>>,
  target_type: string,
  target_id: string,
  userId: string,
): Promise<boolean> {
  if (target_type === "story") {
    const r = await db.get<{ author_id: string; status: string }>(
      "SELECT author_id, status FROM stories WHERE id = ?",
      target_id,
    );
    return Boolean(r && (r.status === "published" || r.author_id === userId));
  }
  if (target_type === "character") {
    const r = await db.get<{ author_id: string; status: string }>(
      "SELECT author_id, status FROM characters WHERE id = ?",
      target_id,
    );
    return Boolean(r && (r.status === "published" || r.author_id === userId));
  }
  const r = await db.get<{ author_id: string; status: string }>(
    "SELECT author_id, status FROM worlds WHERE id = ?",
    target_id,
  );
  return Boolean(r && (r.status === "published" || r.author_id === userId));
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const db = await getDb();

  const existing = await db.get<{ id: string }>(
    "SELECT id FROM favorites WHERE user_id = ? AND target_type = ? AND target_id = ?",
    userId,
    parsed.data.target_type,
    parsed.data.target_id,
  );

  if (existing) {
    await db.run("DELETE FROM favorites WHERE id = ?", existing.id);
    if (parsed.data.target_type === "story") {
      await db.run(
        "UPDATE stories SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END WHERE id = ?",
        parsed.data.target_id,
      );
    } else if (parsed.data.target_type === "character") {
      await db.run(
        "UPDATE characters SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END WHERE id = ?",
        parsed.data.target_id,
      );
    } else {
      await db.run(
        "UPDATE worlds SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END WHERE id = ?",
        parsed.data.target_id,
      );
    }
    return NextResponse.json({ code: 200, msg: "已取消收藏", data: { favorited: false } });
  }

  const ok = await canFavoriteTarget(db, parsed.data.target_type, parsed.data.target_id, userId);
  if (!ok) {
    return NextResponse.json({ code: 400, msg: "内容不存在或未发布" }, { status: 400 });
  }

  await db.run(
    "INSERT INTO favorites (id, user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?)",
    id("fav"),
    userId,
    parsed.data.target_type,
    parsed.data.target_id,
    nowIso(),
  );

  if (parsed.data.target_type === "story") {
    await db.run(
      "UPDATE stories SET favorite_count = favorite_count + 1 WHERE id = ?",
      parsed.data.target_id,
    );
    const story = await db.get<{ author_id: string; title: string }>(
      "SELECT author_id, title FROM stories WHERE id = ?",
      parsed.data.target_id,
    );
    if (story && story.author_id !== userId) {
      await createNotification(db, story.author_id, "favorited", {
        actor_user_id: userId,
        story_id: parsed.data.target_id,
        story_title: story.title,
      });
    }
  } else if (parsed.data.target_type === "character") {
    await db.run(
      "UPDATE characters SET favorite_count = favorite_count + 1 WHERE id = ?",
      parsed.data.target_id,
    );
    const ch = await db.get<{ author_id: string; name: string }>(
      "SELECT author_id, name FROM characters WHERE id = ?",
      parsed.data.target_id,
    );
    if (ch && ch.author_id !== userId) {
      await createNotification(db, ch.author_id, "favorited", {
        actor_user_id: userId,
        character_id: parsed.data.target_id,
        story_title: ch.name,
        content_kind: "character",
      });
    }
  } else {
    await db.run(
      "UPDATE worlds SET favorite_count = favorite_count + 1 WHERE id = ?",
      parsed.data.target_id,
    );
    const w = await db.get<{ author_id: string; name: string }>(
      "SELECT author_id, name FROM worlds WHERE id = ?",
      parsed.data.target_id,
    );
    if (w && w.author_id !== userId) {
      await createNotification(db, w.author_id, "favorited", {
        actor_user_id: userId,
        world_id: parsed.data.target_id,
        story_title: w.name,
        content_kind: "world",
      });
    }
  }

  return NextResponse.json({ code: 200, msg: "收藏成功", data: { favorited: true } });
}
