import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { scanTextBundle } from "@/lib/content-filter";
import { getDb, nowIso } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { enqueueSensitivePublishBlock } from "@/lib/moderation-queue";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const db = await getDb();

  const rlUser = rateLimitAllow(`publish:${userId}`, 35, 3_600_000);
  if (!rlUser.ok) {
    return NextResponse.json(
      { code: 429, msg: "发布过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rlUser.retryAfterMs / 1000)) },
      },
    );
  }
  const rlIp = rateLimitAllow(`publish_ip:${getRequestIp(req)}`, 150, 3_600_000);
  if (!rlIp.ok) {
    return NextResponse.json(
      { code: 429, msg: "当前网络发布过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rlIp.retryAfterMs / 1000)) },
      },
    );
  }

  const row = await db.get<{ id: string; name: string; summary: string; setting_notes: string }>(
    "SELECT id, name, summary, setting_notes FROM worlds WHERE id = ? AND author_id = ?",
    id,
    userId,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "世界不存在" }, { status: 404 });
  }

  const scan = scanTextBundle([row.name, row.summary, row.setting_notes]);
  if (!scan.ok) {
    try {
      await enqueueSensitivePublishBlock(db, {
        contentType: "world",
        targetId: id,
        submitterUserId: userId,
      });
    } catch (e) {
      console.error("[moderation enqueue]", e);
    }
    return NextResponse.json({ code: 400, msg: scan.msg }, { status: 400 });
  }

  const now = nowIso();
  await db.run(
    "UPDATE worlds SET status = 'published', publish_at = ?, updated_at = ? WHERE id = ?",
    now,
    now,
    id,
  );

  const followers = await db.all<{ user_id: string }[]>(
    "SELECT user_id FROM follows WHERE author_id = ?",
    userId,
  );
  for (const f of followers) {
    await createNotification(db, f.user_id, "author_update", {
      author_id: userId,
      world_id: id,
      story_title: row.name,
      content_kind: "world",
    });
  }

  return NextResponse.json({ code: 200, msg: "发布成功", data: { publish_at: now } });
}
