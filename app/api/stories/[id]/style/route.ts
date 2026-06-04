import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { code: 401, msg: "未登录" },
        { status: 401 }
      );
    }

    const { id: storyId } = await params;
    const db = await getDb();

    const story = await db.get<{ id: string; author_id: string }>(
      "SELECT id, author_id FROM stories WHERE id = ?",
      storyId
    );

    if (!story) {
      return NextResponse.json(
        { code: 404, msg: "故事不存在" },
        { status: 404 }
      );
    }

    if (story.author_id !== userId) {
      return NextResponse.json(
        { code: 403, msg: "无权限" },
        { status: 403 }
      );
    }

    const styleAnchor = await db.get<{
      id: string;
      story_id: string;
      features_json: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT * FROM story_style_anchors WHERE story_id = ? ORDER BY updated_at DESC LIMIT 1",
      storyId
    );

    if (!styleAnchor) {
      return NextResponse.json({
        code: 200,
        data: {
          storyId,
          styleAnchor: null,
          message: "尚未提取文风锚点",
        },
        msg: "获取成功",
      });
    }

    let features: Record<string, unknown> = {};
    try {
      features = styleAnchor.features_json
        ? JSON.parse(styleAnchor.features_json)
        : {};
    } catch {}

    return NextResponse.json({
      code: 200,
      data: {
        id: styleAnchor.id,
        storyId: styleAnchor.story_id,
        features,
        createdAt: styleAnchor.created_at,
        updatedAt: styleAnchor.updated_at,
      },
      msg: "获取成功",
    });
  } catch (error) {
    console.error("Get style anchor error:", error);
    return NextResponse.json(
      { code: 500, msg: "获取失败" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { code: 401, msg: "未登录" },
        { status: 401 }
      );
    }

    const { id: storyId } = await params;
    const db = await getDb();

    const story = await db.get<{ id: string; author_id: string }>(
      "SELECT id, author_id FROM stories WHERE id = ?",
      storyId
    );

    if (!story) {
      return NextResponse.json(
        { code: 404, msg: "故事不存在" },
        { status: 404 }
      );
    }

    if (story.author_id !== userId) {
      return NextResponse.json(
        { code: 403, msg: "无权限" },
        { status: 403 }
      );
    }

    const messages = await db.all(
      `SELECT role, content FROM chat_messages
       WHERE session_id IN (
         SELECT id FROM chat_sessions WHERE story_id = ?
       )
       ORDER BY created_at DESC
       LIMIT 50`,
      storyId
    );

    const assistantMessages = messages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join("\n");

    const wordFrequency: Record<string, number> = {};
    const words = assistantMessages.split(/[\s\n.,!?;:'"（）()【】\[\]]+/);

    words.forEach((word) => {
      if (word.length >= 2) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });

    const sortedWords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const highFreqWords = sortedWords.slice(0, 10).map(([word]) => word);
    const forbiddenWords: string[] = [];

    const shortSentenceRatio = (assistantMessages.match(/[。！？.!?]/g) || []).length /
      Math.max(1, assistantMessages.length / 50);
    const dialogueRatio = (assistantMessages.match(/["""''「」『』]/g) || []).length /
      Math.max(1, assistantMessages.length / 100);

    const features = {
      wordPreferences: {
        highFreq: highFreqWords,
        forbidden: forbiddenWords,
      },
      sentencePatterns: {
        shortRatio: shortSentenceRatio,
        dialogueRatio: dialogueRatio,
      },
      emotionalIntensity: {
        tension: 0.5,
        relaxation: 0.5,
      },
      narrativeRhythm: {
        actionDensity: 0.5,
        infoRevealRate: 0.5,
      },
      extractedAt: nowIso(),
      sourceMessageCount: messages.length,
    };

    const anchorId = id("style");
    const now = nowIso();

    await db.run(
      `INSERT INTO story_style_anchors (id, story_id, features_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      anchorId,
      storyId,
      JSON.stringify(features),
      now,
      now
    );

    return NextResponse.json({
      code: 200,
      data: {
        id: anchorId,
        storyId,
        features,
        message: "文风锚点提取成功",
      },
      msg: "提取成功",
    });
  } catch (error) {
    console.error("Extract style anchor error:", error);
    return NextResponse.json(
      { code: 500, msg: "提取失败" },
      { status: 500 }
    );
  }
}
