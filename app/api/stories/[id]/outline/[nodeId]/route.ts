import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(20000).optional(),
  type: z.enum(["chapter", "branch", "note"]).optional(),
  parent_id: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  move: z.enum(["up", "down"]).optional(),
});

async function assertStoryOwner(db: Awaited<ReturnType<typeof getDb>>, storyId: string, userId: string | null) {
  const row = await db.get<{ author_id: string }>("SELECT author_id FROM stories WHERE id = ?", storyId);
  if (!row) return { ok: false as const, reason: "not_found" };
  if (!userId || row.author_id !== userId) return { ok: false as const, reason: "forbidden" };
  return { ok: true as const };
}

async function listSiblingIds(
  db: Awaited<ReturnType<typeof getDb>>,
  storyId: string,
  parentId: string | null,
): Promise<string[]> {
  if (parentId === null) {
    const rows = await db.all<{ id: string }[]>(
      `SELECT id FROM story_outline_nodes WHERE story_id = ? AND parent_id IS NULL ORDER BY sort_order ASC, created_at ASC`,
      storyId,
    );
    return rows.map((r) => r.id);
  }
  const rows = await db.all<{ id: string }[]>(
    `SELECT id FROM story_outline_nodes WHERE story_id = ? AND parent_id = ? ORDER BY sort_order ASC, created_at ASC`,
    storyId,
    parentId,
  );
  return rows.map((r) => r.id);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const { id: storyId, nodeId } = await params;
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

  const node = await db.get<{ id: string; parent_id: string | null; sort_order: number }>(
    "SELECT id, parent_id, sort_order FROM story_outline_nodes WHERE id = ? AND story_id = ?",
    nodeId,
    storyId,
  );
  if (!node) {
    return NextResponse.json({ code: 404, msg: "节点不存在" }, { status: 404 });
  }

  if (parsed.data.move) {
    const siblings = await listSiblingIds(db, storyId, node.parent_id);
    const idx = siblings.indexOf(nodeId);
    if (idx < 0) {
      return NextResponse.json({ code: 400, msg: "节点顺序异常" }, { status: 400 });
    }
    const swapWith =
      parsed.data.move === "up" ? siblings[idx - 1] : siblings[idx + 1];
    if (!swapWith) {
      return NextResponse.json({ code: 200, msg: "已在边界", data: { noop: true } });
    }

    const other = await db.get<{ sort_order: number }>(
      "SELECT sort_order FROM story_outline_nodes WHERE id = ? AND story_id = ?",
      swapWith,
      storyId,
    );
    if (!other) {
      return NextResponse.json({ code: 400, msg: "交换失败" }, { status: 400 });
    }

    const now = nowIso();
    await db.run("UPDATE story_outline_nodes SET sort_order = ?, updated_at = ? WHERE id = ?", other.sort_order, now, nodeId);
    await db.run(
      "UPDATE story_outline_nodes SET sort_order = ?, updated_at = ? WHERE id = ?",
      node.sort_order,
      now,
      swapWith,
    );
    return NextResponse.json({ code: 200, msg: "已调整顺序" });
  }

  if (parsed.data.parent_id !== undefined && parsed.data.parent_id !== node.parent_id) {
    if (parsed.data.parent_id === null || parsed.data.parent_id === "") {
      const maxRow = await db.get<{ mx: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) AS mx FROM story_outline_nodes WHERE story_id = ? AND parent_id IS NULL`,
        storyId,
      );
      const nextOrder = (maxRow?.mx ?? -1) + 1;
      await db.run(
        `UPDATE story_outline_nodes SET parent_id = NULL, sort_order = ?, updated_at = ? WHERE id = ? AND story_id = ?`,
        nextOrder,
        nowIso(),
        nodeId,
        storyId,
      );
    } else {
      const parent = await db.get<{ id: string }>(
        "SELECT id FROM story_outline_nodes WHERE id = ? AND story_id = ?",
        parsed.data.parent_id,
        storyId,
      );
      if (!parent) {
        return NextResponse.json({ code: 400, msg: "父节点无效" }, { status: 400 });
      }
      let walk: string | null = parsed.data.parent_id;
      while (walk) {
        if (walk === nodeId) {
          return NextResponse.json({ code: 400, msg: "不能将节点移动到其子节点下" }, { status: 400 });
        }
        const ancestorRow: { parent_id: string | null } | undefined = await db.get(
          "SELECT parent_id FROM story_outline_nodes WHERE id = ?",
          walk,
        );
        walk = ancestorRow?.parent_id ?? null;
      }
      const maxRow = await db.get<{ mx: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) AS mx FROM story_outline_nodes WHERE story_id = ? AND parent_id = ?`,
        storyId,
        parsed.data.parent_id,
      );
      const nextOrder = (maxRow?.mx ?? -1) + 1;
      await db.run(
        `UPDATE story_outline_nodes SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ? AND story_id = ?`,
        parsed.data.parent_id,
        nextOrder,
        nowIso(),
        nodeId,
        storyId,
      );
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (parsed.data.title !== undefined) {
    fields.push("title = ?");
    values.push(parsed.data.title);
  }
  if (parsed.data.content !== undefined) {
    fields.push("content = ?");
    values.push(parsed.data.content);
  }
  if (parsed.data.type !== undefined) {
    fields.push("type = ?");
    values.push(parsed.data.type);
  }
  if (parsed.data.sort_order !== undefined) {
    fields.push("sort_order = ?");
    values.push(parsed.data.sort_order);
  }

  if (fields.length > 0) {
    fields.push("updated_at = ?");
    values.push(nowIso());
    values.push(nodeId, storyId);
    await db.run(
      `UPDATE story_outline_nodes SET ${fields.join(", ")} WHERE id = ? AND story_id = ?`,
      ...values,
    );
  }

  return NextResponse.json({ code: 200, msg: "更新成功" });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const { id: storyId, nodeId } = await params;
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

  const rows = await db.all<{ id: string }[]>(
    `WITH RECURSIVE tree(id) AS (
       SELECT id FROM story_outline_nodes WHERE id = ? AND story_id = ?
       UNION ALL
       SELECT n.id FROM story_outline_nodes n
       INNER JOIN tree t ON n.parent_id = t.id AND n.story_id = ?
     )
     SELECT id FROM tree`,
    nodeId,
    storyId,
    storyId,
  );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ code: 404, msg: "节点不存在" }, { status: 404 });
  }

  const placeholders = ids.map(() => "?").join(",");
  await db.run(`DELETE FROM story_outline_nodes WHERE id IN (${placeholders})`, ...ids);
  return NextResponse.json({ code: 200, msg: "已删除", data: { deleted: ids.length } });
}
