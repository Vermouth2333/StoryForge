import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; branchId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { code: 401, msg: "未登录" },
        { status: 401 }
      );
    }

    const { id: storyId, branchId } = await params;
    const body = await request.json();

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

    const branch = await db.get<{
      id: string;
      story_id: string;
      parent_id: string | null;
      name: string;
      status: string;
    }>(
      "SELECT id, story_id, parent_id, name, status FROM story_branches WHERE id = ? AND story_id = ?",
      branchId,
      storyId
    );

    if (!branch) {
      return NextResponse.json(
        { code: 404, msg: "分支不存在" },
        { status: 404 }
      );
    }

    if (branch.status !== "active") {
      return NextResponse.json(
        { code: 400, msg: "无法合并已关闭的分支" },
        { status: 400 }
      );
    }

    const { mergeStrategy = "append", mergeNote = "" } = body;

    await db.run("BEGIN");

    try {
      if (mergeStrategy === "replace") {
        await db.run(
          "UPDATE story_branches SET status = 'merged', merged_at = ? WHERE id = ?",
          nowIso(),
          branchId
        );
      } else {
        const parentBranch = await db.get<{ id: string }>(
          "SELECT id FROM story_branches WHERE id = ? AND story_id = ?",
          branch.parent_id || "main",
          storyId
        );

        if (parentBranch) {
          const branchMessages = await db.all(
            `SELECT content, role, created_at FROM chat_messages
             WHERE session_id IN (SELECT id FROM chat_sessions WHERE story_id = ? AND branch_id = ?)
             ORDER BY created_at`,
            storyId,
            branchId
          );

          for (const message of branchMessages) {
            await db.run(
              `INSERT INTO chat_messages (id, session_id, role, content, created_at)
               SELECT id, session_id, ?, ?, ? FROM chat_sessions WHERE story_id = ? AND branch_id = ?`,
              message.role,
              message.content,
              message.created_at,
              storyId,
              branch.parent_id || "main"
            );
          }
        }

        await db.run(
          "UPDATE story_branches SET status = 'merged', merged_at = ?, merged_note = ? WHERE id = ?",
          nowIso(),
          mergeNote,
          branchId
        );
      }

      await db.run("COMMIT");

      return NextResponse.json({
        code: 200,
        data: {
          storyId,
          branchId,
          status: "merged",
          mergedAt: nowIso(),
          strategy: mergeStrategy,
        },
        msg: "分支合并成功",
      });
    } catch (error) {
      await db.run("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Merge branch error:", error);
    return NextResponse.json(
      { code: 500, msg: "合并失败" },
      { status: 500 }
    );
  }
}
