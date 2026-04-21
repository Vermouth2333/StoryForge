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

  const row = await db.get<{ id: string }>(
    "SELECT id FROM worlds WHERE id = ? AND author_id = ?",
    id,
    userId,
  );
  if (!row) {
    return NextResponse.json({ code: 404, msg: "世界不存在" }, { status: 404 });
  }

  const now = nowIso();
  await db.run(
    "UPDATE worlds SET status = 'draft', publish_at = NULL, updated_at = ? WHERE id = ?",
    now,
    id,
  );

  return NextResponse.json({ code: 200, msg: "已下架", data: { updated_at: now } });
}
