import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const createSessionSchema = z.object({
  session_type: z.enum(["story", "character", "world", "explore"]),
  story_id: z.string().nullable().optional(),
  character_id: z.string().nullable().optional(),
  world_id: z.string().nullable().optional(),
  title: z.string().min(1).max(120),
  model_id: z.string().optional(),
});

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const url = new URL(req.url);
  const storyId = url.searchParams.get("story_id");
  const keyword = (url.searchParams.get("q") ?? "").trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Math.min(100, Number(url.searchParams.get("page_size") ?? "20"));
  const offset = (Math.max(page, 1) - 1) * pageSize;
  const db = await getDb();
  const where: string[] = ["user_id = ?"];
  const params: Array<string | number> = [userId];

  if (storyId) {
    where.push("story_id = ?");
    params.push(storyId);
  }
  if (keyword) {
    where.push("title LIKE ?");
    params.push(`%${keyword}%`);
  }
  if (from) {
    where.push("updated_at >= ?");
    params.push(from);
  }
  if (to) {
    where.push("updated_at <= ?");
    params.push(to);
  }

  const rows = await db.all(
    `SELECT id, session_type, story_id, title, last_message_at, created_at, updated_at
     FROM chat_sessions
     WHERE ${where.join(" AND ")}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset,
  );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}

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

  if (parsed.data.story_id) {
    const st = await db.get<{ id: string }>(
      `SELECT id FROM stories WHERE id = ? AND (author_id = ? OR status = 'published')`,
      parsed.data.story_id,
      userId,
    );
    if (!st) {
      return NextResponse.json({ code: 400, msg: "故事不存在或未发布" }, { status: 400 });
    }
  }
  if (parsed.data.character_id) {
    const ch = await db.get<{ id: string }>(
      `SELECT id FROM characters WHERE id = ? AND (author_id = ? OR status = 'published')`,
      parsed.data.character_id,
      userId,
    );
    if (!ch) {
      return NextResponse.json({ code: 400, msg: "角色不存在或未发布" }, { status: 400 });
    }
  }
  if (parsed.data.world_id) {
    const w = await db.get<{ id: string }>(
      `SELECT id FROM worlds WHERE id = ? AND (author_id = ? OR status = 'published')`,
      parsed.data.world_id,
      userId,
    );
    if (!w) {
      return NextResponse.json({ code: 400, msg: "世界不存在或未发布" }, { status: 400 });
    }
  }

  const sessionId = id("session");
  const now = nowIso();

  await db.run(
    `INSERT INTO chat_sessions
      (id, user_id, session_type, story_id, character_id, world_id, title, model_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sessionId,
    userId,
    parsed.data.session_type,
    parsed.data.story_id ?? null,
    parsed.data.character_id ?? null,
    parsed.data.world_id ?? null,
    parsed.data.title,
    parsed.data.model_id ?? null,
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
