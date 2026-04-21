import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(8000).optional(),
  status: z.enum(["active", "archived"]).optional(),
  parent_branch_id: z.string().nullable().optional(),
  fork_outline_node_id: z.string().min(1).optional(),
});

async function assertStoryOwner(db: Awaited<ReturnType<typeof getDb>>, storyId: string, userId: string) {
  const row = await db.get<{ author_id: string }>("SELECT author_id FROM stories WHERE id = ?", storyId);
  if (!row) return { ok: false as const, reason: "not_found" as const };
  if (row.author_id !== userId) return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const };
}

/** PATCH — 更新分支（归档、改名、调整父分支或锚点） */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; branchId: string }> },
) {
  const { id: storyId, branchId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
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

  const exists = await db.get<{ id: string }>(
    "SELECT id FROM story_branches WHERE id = ? AND story_id = ?",
    branchId,
    storyId,
  );
  if (!exists) {
    return NextResponse.json({ code: 404, msg: "分支不存在" }, { status: 404 });
  }

  if (parsed.data.parent_branch_id !== undefined && parsed.data.parent_branch_id !== null) {
    if (parsed.data.parent_branch_id === branchId) {
      return NextResponse.json({ code: 400, msg: "父分支不能是自己" }, { status: 400 });
    }
    const p = await db.get<{ id: string }>(
      "SELECT id FROM story_branches WHERE id = ? AND story_id = ?",
      parsed.data.parent_branch_id,
      storyId,
    );
    if (!p) {
      return NextResponse.json({ code: 400, msg: "父分支不存在" }, { status: 400 });
    }
  }

  if (parsed.data.fork_outline_node_id !== undefined) {
    const fork = await db.get<{ id: string }>(
      "SELECT id FROM story_outline_nodes WHERE id = ? AND story_id = ?",
      parsed.data.fork_outline_node_id,
      storyId,
    );
    if (!fork) {
      return NextResponse.json({ code: 400, msg: "锚点大纲节点不存在" }, { status: 400 });
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.title !== undefined) {
    fields.push("title = ?");
    values.push(parsed.data.title);
  }
  if (parsed.data.description !== undefined) {
    fields.push("description = ?");
    values.push(parsed.data.description);
  }
  if (parsed.data.status !== undefined) {
    fields.push("status = ?");
    values.push(parsed.data.status);
  }
  if (parsed.data.parent_branch_id !== undefined) {
    fields.push("parent_branch_id = ?");
    values.push(parsed.data.parent_branch_id);
  }
  if (parsed.data.fork_outline_node_id !== undefined) {
    fields.push("fork_outline_node_id = ?");
    values.push(parsed.data.fork_outline_node_id);
  }

  if (fields.length === 0) {
    return NextResponse.json({ code: 400, msg: "无更新字段" }, { status: 400 });
  }

  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(branchId);

  await db.run(`UPDATE story_branches SET ${fields.join(", ")} WHERE id = ?`, ...values);
  return NextResponse.json({ code: 200, msg: "更新成功" });
}

/** DELETE — 删除分支（若有子分支则禁止） */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; branchId: string }> },
) {
  const { id: storyId, branchId } = await params;
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

  const child = await db.get<{ c: number }>(
    "SELECT COUNT(1) as c FROM story_branches WHERE story_id = ? AND parent_branch_id = ?",
    storyId,
    branchId,
  );
  if (child && child.c > 0) {
    return NextResponse.json({ code: 409, msg: "请先删除或移动子分支" }, { status: 409 });
  }

  const result = await db.run(
    "DELETE FROM story_branches WHERE id = ? AND story_id = ?",
    branchId,
    storyId,
  );
  if ((result.changes ?? 0) === 0) {
    return NextResponse.json({ code: 404, msg: "分支不存在" }, { status: 404 });
  }
  return NextResponse.json({ code: 200, msg: "已删除" });
}
