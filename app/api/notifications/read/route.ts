import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const db = await getDb();
  if (parsed.data.all) {
    await db.run(
      "UPDATE notifications SET is_read = 1 WHERE receiver_user_id = ?",
      userId,
    );
  } else if (parsed.data.ids && parsed.data.ids.length > 0) {
    const placeholders = parsed.data.ids.map(() => "?").join(",");
    await db.run(
      `UPDATE notifications SET is_read = 1 WHERE receiver_user_id = ? AND id IN (${placeholders})`,
      userId,
      ...parsed.data.ids,
    );
  }
  return NextResponse.json({ code: 200, msg: "已标记已读" });
}
