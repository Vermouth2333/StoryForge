import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

/** 引入角色卡到故事 */
const importCharacterSchema = z.object({
  character_id: z.string().min(1),
});

/** 引入世界卡到故事 */
const importWorldSchema = z.object({
  world_id: z.string().min(1),
});

async function assertStoryOwner(db: Awaited<ReturnType<typeof getDb>>, storyId: string, userId: string) {
  const row = await db.get<{ author_id: string }>("SELECT author_id FROM stories WHERE id = ?", storyId);
  if (!row) return { ok: false as const, reason: "not_found" };
  if (row.author_id !== userId) return { ok: false as const, reason: "forbidden" };
  return { ok: true as const };
}

/** 引入角色卡 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params;
  const body = await req.json();

  // 判断是引入角色还是世界
  if (body.character_id) {
    const parsed = importCharacterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
    }

    const userId = await getCurrentUserId();
    const db = await getDb();
    const gate = await assertStoryOwner(db, storyId, userId);
    if (!gate.ok) {
      const status = gate.reason === "not_found" ? 404 : 403;
      return NextResponse.json({ code: status, msg: gate.reason === "not_found" ? "故事不存在" : "无权操作" }, { status });
    }

    // 验证角色卡存在且可访问
    const character = await db.get<{ id: string; status: string; author_id: string }>(
      "SELECT id, status, author_id FROM characters WHERE id = ?",
      parsed.data.character_id,
    );
    if (!character) {
      return NextResponse.json({ code: 404, msg: "角色卡不存在" }, { status: 404 });
    }
    if (character.status !== "published" && character.author_id !== userId) {
      return NextResponse.json({ code: 403, msg: "无法引入未发布的角色卡" }, { status: 403 });
    }

    // 检查是否已引入
    const existing = await db.get<{ story_id: string }>(
      "SELECT story_id FROM story_characters WHERE story_id = ? AND character_id = ?",
      storyId,
      parsed.data.character_id,
    );
    if (existing) {
      return NextResponse.json({ code: 200, msg: "该角色已引入" });
    }

    await db.run(
      "INSERT INTO story_characters (story_id, character_id, is_custom, created_at) VALUES (?, ?, 0, ?)",
      storyId,
      parsed.data.character_id,
      nowIso(),
    );

    return NextResponse.json({ code: 200, msg: "角色引入成功" });
  }

  if (body.world_id) {
    const parsed = importWorldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
    }

    const userId = await getCurrentUserId();
    const db = await getDb();
    const gate = await assertStoryOwner(db, storyId, userId);
    if (!gate.ok) {
      const status = gate.reason === "not_found" ? 404 : 403;
      return NextResponse.json({ code: status, msg: gate.reason === "not_found" ? "故事不存在" : "无权操作" }, { status });
    }

    const world = await db.get<{ id: string; status: string; author_id: string }>(
      "SELECT id, status, author_id FROM worlds WHERE id = ?",
      parsed.data.world_id,
    );
    if (!world) {
      return NextResponse.json({ code: 404, msg: "世界卡不存在" }, { status: 404 });
    }
    if (world.status !== "published" && world.author_id !== userId) {
      return NextResponse.json({ code: 403, msg: "无法引入未发布的世界卡" }, { status: 403 });
    }

    const existing = await db.get<{ story_id: string }>(
      "SELECT story_id FROM story_worlds WHERE story_id = ? AND world_id = ?",
      storyId,
      parsed.data.world_id,
    );
    if (existing) {
      return NextResponse.json({ code: 200, msg: "该世界已引入" });
    }

    await db.run(
      "INSERT INTO story_worlds (story_id, world_id, created_at) VALUES (?, ?, ?)",
      storyId,
      parsed.data.world_id,
      nowIso(),
    );

    return NextResponse.json({ code: 200, msg: "世界引入成功" });
  }

  return NextResponse.json({ code: 400, msg: "请提供 character_id 或 world_id" }, { status: 400 });
}

/** 获取故事已引入的角色和世界 */
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
    return NextResponse.json({ code: status, msg: gate.reason === "not_found" ? "故事不存在" : "无权查看" }, { status });
  }

  const characters = await db.all<{ id: string; name: string; summary: string; avatar_url: string | null; is_custom: number }[]>(
    `SELECT c.id, c.name, c.summary, c.avatar_url, sc.is_custom
     FROM characters c
     INNER JOIN story_characters sc ON c.id = sc.character_id
     WHERE sc.story_id = ?
     ORDER BY sc.created_at ASC`,
    storyId,
  );

  const worlds = await db.all<{ id: string; name: string; summary: string; cover_asset_id: string | null }[]>(
    `SELECT w.id, w.name, w.summary, w.cover_asset_id
     FROM worlds w
     INNER JOIN story_worlds sw ON w.id = sw.world_id
     WHERE sw.story_id = ?
     ORDER BY sw.created_at ASC`,
    storyId,
  );

  return NextResponse.json({
    code: 200,
    data: { characters, worlds },
    msg: "ok",
  });
}

/** 移除引入的角色或世界 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: storyId } = await params;
  const body = await req.json();
  const userId = await getCurrentUserId();
  const db = await getDb();
  const gate = await assertStoryOwner(db, storyId, userId);
  if (!gate.ok) {
    const status = gate.reason === "not_found" ? 404 : 403;
    return NextResponse.json({ code: status, msg: gate.reason === "not_found" ? "故事不存在" : "无权操作" }, { status });
  }

  if (body.character_id) {
    await db.run(
      "DELETE FROM story_characters WHERE story_id = ? AND character_id = ?",
      storyId,
      body.character_id,
    );
    return NextResponse.json({ code: 200, msg: "已移除角色" });
  }

  if (body.world_id) {
    await db.run(
      "DELETE FROM story_worlds WHERE story_id = ? AND world_id = ?",
      storyId,
      body.world_id,
    );
    return NextResponse.json({ code: 200, msg: "已移除世界" });
  }

  return NextResponse.json({ code: 400, msg: "请提供 character_id 或 world_id" }, { status: 400 });
}
