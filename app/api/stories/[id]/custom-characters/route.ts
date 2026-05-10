import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

const createCustomCharacterSchema = z.object({
  name: z.string().min(1).max(50),
  gender: z.string().optional(),
  age: z.string().optional(),
  appearance: z.string().optional(),
  personality: z.string().optional(),
  background: z.string().optional(),
  abilities: z.string().optional(),
  avatar_asset_id: z.string().optional(),
});

const importTemplateSchema = z.object({
  template_character_id: z.string(),
  modifications: z
    .object({
      name: z.string().optional(),
      personality: z.string().optional(),
      background: z.string().optional(),
    })
    .optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const body = await request.json();
    const parsed = createCustomCharacterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 400, msg: "参数错误", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
    }

    const db = await getDb();
    const story = await db.get<{ id: string; author_id: string }>(
      "SELECT id, author_id FROM stories WHERE id = ?",
      storyId
    );

    if (!story) {
      return NextResponse.json({ code: 404, msg: "故事不存在" }, { status: 404 });
    }

    if (story.author_id !== userId) {
      return NextResponse.json({ code: 403, msg: "无权限" }, { status: 403 });
    }

    const characterId = id("char");
    const now = nowIso();

    await db.run(
      `INSERT INTO characters
       (id, author_id, name, gender, age, appearance, personality, background, abilities, avatar_asset_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom', ?, ?)`,
      characterId,
      userId,
      parsed.data.name,
      parsed.data.gender || null,
      parsed.data.age || null,
      parsed.data.appearance || null,
      parsed.data.personality || null,
      parsed.data.background || null,
      parsed.data.abilities || null,
      parsed.data.avatar_asset_id || null,
      now,
      now
    );

    await db.run(
      `INSERT INTO story_characters (story_id, character_id, is_custom, created_at)
       VALUES (?, ?, 1, ?)`,
      storyId,
      characterId,
      now
    );

    return NextResponse.json({
      code: 200,
      data: {
        character_id: characterId,
        name: parsed.data.name,
        created_at: now,
      },
      msg: "创建成功",
    });
  } catch (error) {
    console.error("Create custom character error:", error);
    return NextResponse.json(
      { code: 500, msg: "创建失败" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storyId } = await params;
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
    }

    const db = await getDb();

    const customCharacters = await db.all(
      `SELECT c.id, c.name, c.gender, c.age, c.personality, c.avatar_asset_id, c.created_at
       FROM characters c
       INNER JOIN story_characters sc ON c.id = sc.character_id
       WHERE sc.story_id = ? AND sc.is_custom = 1
       ORDER BY c.created_at DESC`,
      storyId
    );

    return NextResponse.json({
      code: 200,
      data: {
        story_id: storyId,
        characters: customCharacters,
      },
      msg: "获取成功",
    });
  } catch (error) {
    console.error("Get custom characters error:", error);
    return NextResponse.json(
      { code: 500, msg: "获取失败" },
      { status: 500 }
    );
  }
}
