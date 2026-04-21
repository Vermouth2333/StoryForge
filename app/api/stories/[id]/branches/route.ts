import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const postSchema = z.object({
  title: z.string().min(1).max(200),
  fork_outline_node_id: z.string().min(1),
  parent_branch_id: z.string().nullable().optional(),
  description: z.string().max(8000).optional().default(""),
});

async function assertStoryOwner(db: Awaited<ReturnType<typeof getDb>>, storyId: string, userId: string) {
  const row = await db.get<{ author_id: string }>("SELECT author_id FROM stories WHERE id = ?", storyId);
  if (!row) return { ok: false as const, reason: "not_found" as const };
  if (row.author_id !== userId) return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const };
}

/** GET — 列出故事的所有剧情分支记录 */
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

  const rows = await db.all<
    {
      id: string;
      story_id: string;
      parent_branch_id: string | null;
      fork_outline_node_id: string;
      title: string;
      description: string;
      status: string;
      created_at: string;
      updated_at: string;
    }[]
  >(
    `SELECT id, story_id, parent_branch_id, fork_outline_node_id, title, description, status, created_at, updated_at
     FROM story_branches
     WHERE story_id = ?
     ORDER BY datetime(created_at) DESC`,
    storyId,
  );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}

/** POST — 从大纲节点锚点创建分支记录 */
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

  const fork = await db.get<{ id: string }>(
    "SELECT id FROM story_outline_nodes WHERE id = ? AND story_id = ?",
    parsed.data.fork_outline_node_id,
    storyId,
  );
  if (!fork) {
    return NextResponse.json({ code: 400, msg: "锚点大纲节点不存在" }, { status: 400 });
  }

  const parentId = parsed.data.parent_branch_id ?? null;
  if (parentId) {
    const p = await db.get<{ id: string }>(
      "SELECT id FROM story_branches WHERE id = ? AND story_id = ?",
      parentId,
      storyId,
    );
    if (!p) {
      return NextResponse.json({ code: 400, msg: "父分支不存在" }, { status: 400 });
    }
  }

  const bid = id("bch");
  const ts = nowIso();
  await db.run(
    `INSERT INTO story_branches
     (id, story_id, parent_branch_id, fork_outline_node_id, title, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    bid,
    storyId,
    parentId,
    parsed.data.fork_outline_node_id,
    parsed.data.title,
    parsed.data.description,
    ts,
    ts,
  );

  return NextResponse.json({
    code: 200,
    msg: "已创建",
    data: {
      id: bid,
      story_id: storyId,
      parent_branch_id: parentId,
      fork_outline_node_id: parsed.data.fork_outline_node_id,
      title: parsed.data.title,
      description: parsed.data.description,
      status: "active",
      created_at: ts,
      updated_at: ts,
    },
  });
}
