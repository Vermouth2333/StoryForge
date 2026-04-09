import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const createSessionSchema = z.object({
  session_type: z.enum(["story", "character", "world"]),
  story_id: z.string().nullable().optional(),
  character_id: z.string().nullable().optional(),
  world_id: z.string().nullable().optional(),
  title: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 400, msg: "参数错误", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const sessionId = id("session");
  const now = nowIso();

  await db.run(
    `INSERT INTO chat_sessions
      (id, user_id, session_type, story_id, character_id, world_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sessionId,
    userId,
    parsed.data.session_type,
    parsed.data.story_id ?? null,
    parsed.data.character_id ?? null,
    parsed.data.world_id ?? null,
    parsed.data.title,
    now,
    now,
  );

  return NextResponse.json({
    code: 200,
    data: {
      session_id: sessionId,
      title: parsed.data.title,
      created_at: now,
    },
    msg: "创建成功",
  });
}
