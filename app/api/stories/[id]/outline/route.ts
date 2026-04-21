import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const postSchema = z.object({
  title: z.string().min(1).max(200),
  parent_id: z.string().nullable().optional(),
  type: z.enum(["chapter", "branch", "note"]).optional().default("chapter"),
  content: z.string().max(20000).optional().default(""),
});

async function assertStoryOwner(db: Awaited<ReturnType<typeof getDb>>, storyId: string, userId: string) {
  const row = await db.get<{ author_id: string }>("SELECT author_id FROM stories WHERE id = ?", storyId);
  if (!row) return { ok: false as const, reason: "not_found" };
  if (row.author_id !== userId) return { ok: false as const, reason: "forbidden" };
  return { ok: true as const };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params;
  const userId = await getCurrentUserId();
  const db = await getDb();
  const gate = await assertStoryOwner(db, storyId, userId);
  if (!gate.ok) {
    const status = gate.reason === "not_found" ? 404 : 403;
    return NextResponse.json(
      { code: status, msg: gate.reason === "not_found" ? "故事不存在" : "无权查看" },
      { status },
    );
  }

  const rows = await db.all<Record<string, unknown>[]>(
    `SELECT id, story_id, parent_id, title, type, sort_order, content, created_at, updated_at
     FROM story_outline_nodes
     WHERE story_id = ?
     ORDER BY parent_id IS NULL DESC, parent_id, sort_order, created_at`,
    storyId,
  );
  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  const db = await getDb();
  const gate = await assertStoryOwner(db, storyId, userId);
  if (!gate.ok) {
    const status = gate.reason === "not_found" ? 404 : 403;
    return NextResponse.json(
      { code: status, msg: gate.reason === "not_found" ? "故事不存在" : "无权操作" },
      { status },
    );
  }

  if (parsed.data.parent_id) {
    const parent = await db.get<{ id: string }>(
      "SELECT id FROM story_outline_nodes WHERE id = ? AND story_id = ?",
      parsed.data.parent_id,
      storyId,
    );
    if (!parent) {
      return NextResponse.json({ code: 400, msg: "父节点无效" }, { status: 400 });
    }
  }

  let cond = "story_id = ? AND parent_id IS NULL";
  const bind: unknown[] = [storyId];
  if (parsed.data.parent_id) {
    cond = "story_id = ? AND parent_id = ?";
    bind.push(parsed.data.parent_id);
  }

  const maxRow = await db.get<{ mx: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) AS mx FROM story_outline_nodes WHERE ${cond}`,
    ...bind,
  );
  const sortOrder = (maxRow?.mx ?? -1) + 1;
  const nodeId = id("node");
  const now = nowIso();

  await db.run(
    `INSERT INTO story_outline_nodes
      (id, story_id, parent_id, title, type, sort_order, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    nodeId,
    storyId,
    parsed.data.parent_id ?? null,
    parsed.data.title,
    parsed.data.type,
    sortOrder,
    parsed.data.content,
    now,
    now,
  );

  return NextResponse.json({
    code: 200,
    msg: "创建成功",
    data: { id: nodeId, sort_order: sortOrder, created_at: now },
  });
}
