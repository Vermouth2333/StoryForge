import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  await db.run(
    "UPDATE stories SET status = 'draft', updated_at = ? WHERE id = ?",
    nowIso(),
    id,
  );
  return NextResponse.json({ code: 200, msg: "已下架，状态改为草稿" });
}
