import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface ChainNode {
  id: string;
  workType: string;
  workId: string;
  workTitle: string;
  authorId: string;
  relationType: string;
  level: number;
  path: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workType: string; workId: string }> }
) {
  try {
    await getCurrentUserId();

    const { workType, workId } = await params;

    if (!["story", "character", "world"].includes(workType)) {
      return NextResponse.json(
        { code: 400, msg: "无效的作品类型" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const chain: ChainNode[] = [];
    const visited = new Set<string>();

    const workTable = workType === "story" ? "stories" : workType === "character" ? "characters" : "worlds";
    const workTitleField = workType === "story" ? "title" : "name";
    const work = await db.get<{ id: string; author_id: string }>(
      `SELECT id, author_id FROM ${workTable} WHERE id = ?`,
      workId
    );

    if (work) {
      chain.push({
        id: workId,
        workType,
        workId,
        workTitle: workTitleField === "title" ? (work as any).title : (work as any).name,
        authorId: work.author_id,
        relationType: "self",
        level: 0,
        path: [workId],
      });
      visited.add(`${workType}:${workId}`);
    }

    const maxDepth = 3;
    let currentLevelNodes = [{ workType, workId }];
    let currentLevel = 1;

    while (currentLevel <= maxDepth) {
      const nextLevelNodes: Array<{ workType: string; workId: string }> = [];

      for (const node of currentLevelNodes) {
        const derivedRelations = await db.all(
          `SELECT dr.*, ${workTable}.${workTitleField} as work_title, ${workTable}.author_id
           FROM derivative_relations dr
           LEFT JOIN ${workTable} ON dr.derived_work_id = ${workTable}.id
           WHERE dr.original_work_id = ? AND dr.original_work_type = ? AND dr.derived_work_type = ?`,
          node.workId,
          node.workType,
          workType
        );

        for (const relation of derivedRelations) {
          const key = `${relation.derived_work_type}:${relation.derived_work_id}`;
          if (!visited.has(key)) {
            visited.add(key);
            chain.push({
              id: relation.id,
              workType: relation.derived_work_type,
              workId: relation.derived_work_id,
              workTitle: relation.work_title,
              authorId: relation.author_id,
              relationType: relation.relation_type,
              level: currentLevel,
              path: [...node.workId ? [node.workId] : [], relation.derived_work_id],
            });
            nextLevelNodes.push({
              workType: relation.derived_work_type,
              workId: relation.derived_work_id,
            });
          }
        }

        const originalRelations = await db.all(
          `SELECT dr.*, ${workTable}.${workTitleField} as work_title, ${workTable}.author_id
           FROM derivative_relations dr
           LEFT JOIN ${workTable} ON dr.original_work_id = ${workTable}.id
           WHERE dr.derived_work_id = ? AND dr.derived_work_type = ? AND dr.original_work_type = ?`,
          node.workId,
          node.workType,
          workType
        );

        for (const relation of originalRelations) {
          const key = `${relation.original_work_type}:${relation.original_work_id}`;
          if (!visited.has(key)) {
            visited.add(key);
            chain.push({
              id: relation.id,
              workType: relation.original_work_type,
              workId: relation.original_work_id,
              workTitle: relation.work_title,
              authorId: relation.author_id,
              relationType: relation.relation_type,
              level: currentLevel,
              path: [...node.workId ? [node.workId] : [], relation.original_work_id],
            });
            nextLevelNodes.push({
              workType: relation.original_work_type,
              workId: relation.original_work_id,
            });
          }
        }
      }

      currentLevelNodes = nextLevelNodes;
      if (currentLevelNodes.length === 0) break;
      currentLevel++;
    }

    return NextResponse.json({
      code: 200,
      data: {
        rootWorkId: workId,
        rootWorkType: workType,
        chain,
        totalCount: chain.length,
        maxDepth,
      },
      msg: "获取成功",
    });
  } catch (error) {
    console.error("Get derivative chain error:", error);
    return NextResponse.json(
      { code: 500, msg: "获取失败" },
      { status: 500 }
    );
  }
}
