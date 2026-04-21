import { NextResponse } from "next/server";
import type { Database } from "sqlite";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const postSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(20000).optional().default(""),
  sort_order: z.number().int().min(0).max(1_000_000).optional(),
});

async function canViewWorldKnowledge(
  db: Database,
  worldId: string,
  userId: string,
) {
  const w = await db.get<{ author_id: string; status: string }>(
    "SELECT author_id, status FROM worlds WHERE id = ?",
    worldId,
  );
  if (!w) return { ok: false as const, reason: "not_found" as const };
  if (w.status === "published" || w.author_id === userId) {
    return { ok: true as const, world: w };
  }
  return { ok: false as const, reason: "forbidden" as const };
}

/** GET — 世界知识库列表（已发布对所有人；草稿仅作者） */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: worldId } = await params;
  const userId = await getCurrentUserId();
  const db = await getDb();
  const access = await canViewWorldKnowledge(db, worldId, userId);
  if (!access.ok) {
    if (access.reason === "not_found") {
      return NextResponse.json({ code: 404, msg: "世界不存在" }, { status: 404 });
    }
    return NextResponse.json({ code: 403, msg: "无权查看该世界的知识库" }, { status: 403 });
  }

  const rows = await db.all<
    {
      id: string;
      world_id: string;
      title: string;
      body: string;
      sort_order: number;
      created_at: string;
      updated_at: string;
    }[]
  >(
    `SELECT id, world_id, title, body, sort_order, created_at, updated_at
     FROM knowledge_entries
     WHERE world_id = ?
     ORDER BY sort_order ASC, datetime(created_at) ASC`,
    worldId,
  );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}

/** POST — 新增词条（仅作者） */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: worldId } = await params;
  const userId = await getCurrentUserId();
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const db = await getDb();
  const owned = await db.get<{ id: string }>(
    "SELECT id FROM worlds WHERE id = ? AND author_id = ?",
    worldId,
    userId,
  );
  if (!owned) {
    return NextResponse.json({ code: 403, msg: "仅作者可编辑知识库" }, { status: 403 });
  }

  let sort = parsed.data.sort_order;
  if (sort === undefined) {
    const maxRow = await db.get<{ m: number | null }>(
      "SELECT MAX(sort_order) as m FROM knowledge_entries WHERE world_id = ?",
      worldId,
    );
    sort = (maxRow?.m ?? -1) + 1;
  }

  const eid = id("know");
  const ts = nowIso();
  await db.run(
    `INSERT INTO knowledge_entries (id, world_id, title, body, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    eid,
    worldId,
    parsed.data.title,
    parsed.data.body,
    sort,
    ts,
    ts,
  );

  return NextResponse.json({
    code: 200,
    msg: "已创建",
    data: {
      id: eid,
      world_id: worldId,
      title: parsed.data.title,
      body: parsed.data.body,
      sort_order: sort,
      created_at: ts,
      updated_at: ts,
    },
  });
}
