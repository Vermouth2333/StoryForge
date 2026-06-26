import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const schema = z.object({
  story_id: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 200, msg: "ok" });
  }
  const db = await getDb();
  await db.run(
    "INSERT INTO feed_impressions (id, user_id, story_id, created_at) VALUES (?, ?, ?, ?)",
    id("imp"),
    userId,
    parsed.data.story_id,
    nowIso(),
  );
  return NextResponse.json({ code: 200, msg: "ok" });
}
