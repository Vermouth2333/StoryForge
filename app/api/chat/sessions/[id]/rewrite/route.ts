import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, id, nowIso } from "@/lib/db";
import { scanTextBundle } from "@/lib/content-filter";
import { ModelManager } from "@/lib/model-manager";
import { resolveProvider, streamChat } from "@/lib/ai-provider";
import { buildChatContext } from "@/lib/prompt-context";

const rewriteSchema = z.object({
  paragraph_id: z.string(),
  original_content: z.string(),
  instruction: z.string().optional(),
  preserve_context: z.boolean().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const parsed = rewriteSchema.safeParse(body);

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
    const session = await db.get<{
      id: string;
      session_type: string;
      story_id: string | null;
      character_id: string | null;
      world_id: string | null;
    }>(
      "SELECT id, session_type, story_id, character_id, world_id FROM chat_sessions WHERE id = ? AND user_id = ?",
      sessionId,
      userId
    );

    if (!session) {
      return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
    }

    const scanResult = scanTextBundle([parsed.data.original_content], 50000);
    if (!scanResult.ok) {
      return NextResponse.json({ code: 400, msg: scanResult.msg }, { status: 400 });
    }

    const rewriteInstruction =
      parsed.data.instruction || "请重新生成这段内容，保持相同的风格和情节走向";

    // 段落级再生成：接入真实模型（未配置时回退到占位输出）
    const modelId = await ModelManager.getSessionModel(sessionId, userId);
    const modelConfig = await ModelManager.getModelConfig(modelId, userId);
    const provider = modelConfig ? resolveProvider(modelConfig) : null;

    const mockRewrite = `[重新生成的段落]\n\n基于以下上下文和指令重新生成的内容：\n\n指令：${rewriteInstruction}\n\n这是模拟的重新生成结果（未配置真实模型）。请在「设置 → 模型管理」页面配置 API Key 和模型，即可启用真实模型输出。`;

    let rewrittenContent = mockRewrite;
    let usedModelName = "mock-model";

    if (provider && modelConfig) {
      try {
        const rewritePrompt = [
          "请在保持原有文风、人物人设与世界设定一致的前提下，重写下面这段内容。只输出重写后的正文，不要追加解释。",
          "",
          `【原段落】\n${parsed.data.original_content}`,
          "",
          `【改写要求】\n${rewriteInstruction}`,
        ].join("\n");
        const contextMessages = await buildChatContext(
          db,
          sessionId,
          session,
          rewritePrompt,
        );
        let acc = "";
        for await (const delta of streamChat(provider, contextMessages, {
          temperature: modelConfig.defaultTemperature,
          maxTokens: modelConfig.maxTokens,
        })) {
          acc += delta;
        }
        const trimmed = acc.trim();
        if (trimmed.length > 0) {
          const outScan = scanTextBundle([trimmed], 50000);
          if (outScan.ok) {
            rewrittenContent = trimmed;
            usedModelName = modelConfig.modelName;
          }
        }
      } catch {
        // 真实模型失败时保留占位结果，不中断请求
      }
    }

    const rewriteMessageId = id("msg");
    const now = nowIso();

    await db.run(
      `INSERT INTO chat_messages (id, session_id, role, content, model_name, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?)`,
      rewriteMessageId,
      sessionId,
      rewrittenContent,
      usedModelName,
      now
    );

    return NextResponse.json({
      code: 200,
      data: {
        message_id: rewriteMessageId,
        original_content: parsed.data.original_content,
        rewritten_content: rewrittenContent,
        model_name: usedModelName,
        suggestion: "auto_fix_draft",
      },
      msg: "重新生成成功",
    });
  } catch (error) {
    console.error("Rewrite error:", error);
    return NextResponse.json(
      { code: 500, msg: "重新生成失败" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
    }

    const db = await getDb();
    const session = await db.get(
      "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
      sessionId,
      userId
    );

    if (!session) {
      return NextResponse.json({ code: 404, msg: "会话不存在" }, { status: 404 });
    }

    const paragraphs = await db.all(
      `SELECT id, content, created_at
       FROM chat_messages
       WHERE session_id = ? AND role = 'assistant'
       ORDER BY created_at DESC
       LIMIT 50`,
      sessionId
    );

    return NextResponse.json({
      code: 200,
      data: {
        session_id: sessionId,
        paragraphs: paragraphs.map((p) => ({
          id: p.id,
          content: p.content,
          created_at: p.created_at,
        })),
      },
      msg: "获取成功",
    });
  } catch (error) {
    console.error("Get paragraphs error:", error);
    return NextResponse.json(
      { code: 500, msg: "获取失败" },
      { status: 500 }
    );
  }
}
