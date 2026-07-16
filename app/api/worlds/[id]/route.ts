import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { deleteWorld } from "@/lib/delete-content";
import { getDb, nowIso } from "@/lib/db";
import { invalidateMarketCache } from "@/lib/invalidate-market-cache";
import { patchWorldWork } from "@/lib/work-draft";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  summary: z.string().max(1000).optional(),
  setting_notes: z.string().max(8000).optional(),
  cover_asset_id: z.string().max(120).nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  sync_to_market: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = await getDb();
  const row = await db.get<Record<string, unknown>>(
    `SELECT w.id, w.author_id,
      CASE WHEN u.status = 'deleted' THEN '已注销用户' ELSE COALESCE(u.username, u.id) END AS author_display,
      w.name, w.cover_asset_id, w.summary, w.setting_notes, w.tags_json, w.draft_json, w.status, w.like_count, w.favorite_count, w.publish_at, w.updated_at
     FROM worlds w
     LEFT JOIN users u ON u.id = w.author_id
     WHERE w.id = ?`,
    id,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "世界不存在" }, { status: 404 });
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
      "SELECT id FROM likes WHERE user_id = ? AND target_type = 'world' AND target_id = ?",
      userId,
      id,
    );
    likedByMe = Boolean(likeRow);
    const favRow = await db.get<{ id: string }>(
      "SELECT id FROM favorites WHERE user_id = ? AND target_type = 'world' AND target_id = ?",
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
    data: {
      ...row,
      cover_url: coverUrl,
      cover_thumbnail_url: coverThumbUrl,
      liked_by_me: likedByMe,
      favorited_by_me: favoritedByMe,
      is_following: isFollowing,
      draft_json: userId === row.author_id ? row.draft_json ?? null : null,
      has_unsynced_draft: userId === row.author_id && Boolean(row.draft_json),
    },
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
    "SELECT id, status FROM worlds WHERE id = ? AND author_id = ?",
    id,
    userId,
  );
  if (!owned) {
    return NextResponse.json({ code: 404, msg: "世界不存在" }, { status: 404 });
  }

  const { sync_to_market: syncToMarket = false, cover_asset_id, ...patchData } = parsed.data;
  const now = nowIso();
  const { syncedToMarket } = await patchWorldWork(
    db,
    id,
    owned.status,
    syncToMarket,
    patchData,
    now,
  );
  if (cover_asset_id !== undefined) {
    await db.run("UPDATE worlds SET cover_asset_id = ?, updated_at = ? WHERE id = ?", cover_asset_id, now, id);
  }
  if (syncedToMarket || (cover_asset_id !== undefined && owned.status === "published" && syncToMarket)) {
    await invalidateMarketCache();
  }
  return NextResponse.json({
    code: 200,
    msg: syncedToMarket ? "已同步到市场" : owned.status === "published" ? "已保存草稿" : "更新成功",
    data: { synced_to_market: syncedToMarket },
  });
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
  const result = await deleteWorld(db, id, userId);
  if (!result.ok) {
    const status = result.msg.includes("不存在") ? 404 : 400;
    return NextResponse.json({ code: status, msg: result.msg }, { status });
  }
  return NextResponse.json({ code: 200, msg: "世界已删除" });
}
