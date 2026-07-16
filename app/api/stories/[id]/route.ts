import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { deleteStory } from "@/lib/delete-content";
import { getDb, nowIso } from "@/lib/db";
import { invalidateMarketCache } from "@/lib/invalidate-market-cache";
import { patchStoryWork } from "@/lib/work-draft";

const schema = z.object({
  title: z.string().min(1).max(120).optional(),
  summary: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  sync_to_market: z.boolean().optional(),
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
    cover_asset_id: string | null;
    like_count: number;
    favorite_count: number;
    publish_at: string | null;
    draft_json: string | null;
    updated_at: string;
  }>(
    `SELECT s.id, s.author_id,
      CASE WHEN u.status = 'deleted' THEN '已注销用户' ELSE COALESCE(u.username, u.id) END AS author_display,
      s.title, s.summary, s.status, s.tags_json, s.cover_asset_id, s.draft_json, s.like_count, s.favorite_count, s.publish_at, s.updated_at
     FROM stories s
     LEFT JOIN users u ON u.id = s.author_id
     WHERE s.id = ?`,
    id,
  );
  if (!story) {
    return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
  }
  // 拼接封面 URL
  const coverAssetId = story.cover_asset_id ? String(story.cover_asset_id) : null;
  const coverUrl = coverAssetId ? `/api/assets/${coverAssetId}/file` : null;
  const coverThumbUrl = coverAssetId ? `/api/assets/${coverAssetId}/thumbnail` : null;
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
    data: {
      ...story,
      cover_url: coverUrl,
      cover_thumbnail_url: coverThumbUrl,
      liked_by_me: likedByMe,
      favorited_by_me: favoritedByMe,
      is_following: isFollowing,
      draft_json: userId === story.author_id ? story.draft_json ?? null : null,
      has_unsynced_draft: userId === story.author_id && Boolean(story.draft_json),
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const story = await db.get<{ id: string; status: string }>(
    "SELECT id, status FROM stories WHERE id = ? AND author_id = ?",
    id,
    userId,
  );
  if (!story) {
    return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
  }

  const { sync_to_market: syncToMarket = false, ...patchData } = parsed.data;
  const now = nowIso();
  const { syncedToMarket } = await patchStoryWork(
    db,
    id,
    story.status,
    syncToMarket,
    patchData,
    now,
  );
  if (syncedToMarket) {
    await invalidateMarketCache();
  }
  return NextResponse.json({
    code: 200,
    msg: syncedToMarket ? "已同步到市场" : story.status === "published" ? "已保存草稿" : "更新成功",
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
  const result = await deleteStory(db, id, userId);
  if (!result.ok) {
    const status = result.msg.includes("不存在") ? 404 : 400;
    return NextResponse.json({ code: status, msg: result.msg }, { status });
  }
  return NextResponse.json({ code: 200, msg: "故事已删除" });
}
