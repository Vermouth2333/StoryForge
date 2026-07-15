import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { deleteCharacter } from "@/lib/delete-content";
import { getDb, nowIso } from "@/lib/db";
import { invalidateMarketCache } from "@/lib/invalidate-market-cache";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  summary: z.string().max(1000).optional(),
  personality: z.string().max(8000).optional(),
  avatar_url: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = await getDb();
  const row = await db.get<Record<string, unknown>>(
    `SELECT c.id, c.author_id,
      CASE WHEN u.status = 'deleted' THEN '已注销用户' ELSE COALESCE(u.username, u.id) END AS author_display,
      c.name, c.avatar_url, c.cover_asset_id, c.summary, c.personality, c.tags_json, c.status, c.like_count, c.favorite_count, c.publish_at, c.updated_at
     FROM characters c
     LEFT JOIN users u ON u.id = c.author_id
     WHERE c.id = ?`,
    id,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "角色不存在" }, { status: 404 });
  }
  // 拼接封面 URL
  const coverAssetId = row.cover_asset_id ? String(row.cover_asset_id) : null;
  const coverUrl = coverAssetId ? `/api/assets/${coverAssetId}/file` : null;
  const coverThumbUrl = coverAssetId ? `/api/assets/${coverAssetId}/thumbnail` : null;
  const userId = await getCurrentUserId();
  let likedByMe = false;
  let favoritedByMe = false;
  let isFollowing = false;
  if (userId) {
    const likeRow = await db.get<{ id: string }>(
      "SELECT id FROM likes WHERE user_id = ? AND target_type = 'character' AND target_id = ?",
      userId,
      id,
    );
    likedByMe = Boolean(likeRow);
    const favRow = await db.get<{ id: string }>(
      "SELECT id FROM favorites WHERE user_id = ? AND target_type = 'character' AND target_id = ?",
      userId,
      id,
    );
    favoritedByMe = Boolean(favRow);
    const authorId = String(row.author_id ?? "");
    if (authorId && authorId !== userId) {
      const followRow = await db.get<{ id: string }>(
        "SELECT id FROM follows WHERE user_id = ? AND author_id = ?",
        userId,
        authorId,
      );
      isFollowing = Boolean(followRow);
    }
  }
  return NextResponse.json({
    code: 200,
    data: { ...row, cover_url: coverUrl, cover_thumbnail_url: coverThumbUrl, liked_by_me: likedByMe, favorited_by_me: favoritedByMe, is_following: isFollowing },
    msg: "ok",
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const owned = await db.get<{ id: string; status: string }>(
    "SELECT id, status FROM characters WHERE id = ? AND author_id = ?",
    id,
    userId,
  );
  if (!owned) {
    return NextResponse.json({ code: 404, msg: "角色不存在" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.name !== undefined) {
    fields.push("name = ?");
    values.push(parsed.data.name);
  }
  if (parsed.data.summary !== undefined) {
    fields.push("summary = ?");
    values.push(parsed.data.summary);
  }
  if (parsed.data.personality !== undefined) {
    fields.push("personality = ?");
    values.push(parsed.data.personality);
  }
  if (parsed.data.avatar_url !== undefined) {
    fields.push("avatar_url = ?");
    values.push(parsed.data.avatar_url);
  }
  if (parsed.data.tags !== undefined) {
    fields.push("tags_json = ?");
    values.push(JSON.stringify(parsed.data.tags));
  }
  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(id);

  await db.run(`UPDATE characters SET ${fields.join(", ")} WHERE id = ?`, ...values);
  if (owned.status === "published") {
    await invalidateMarketCache();
  }
  return NextResponse.json({ code: 200, msg: "更新成功" });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const db = await getDb();
  const result = await deleteCharacter(db, id, userId);
  if (!result.ok) {
    const status = result.msg.includes("不存在") ? 404 : 400;
    return NextResponse.json({ code: status, msg: result.msg }, { status });
  }
  return NextResponse.json({ code: 200, msg: "角色已删除" });
}
