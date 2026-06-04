import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

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

    let originalRelations: Record<string, unknown>[] = [];
    let derivedRelations: Record<string, unknown>[] = [];

    if (workType === "story") {
      originalRelations = await db.all(
        `SELECT dr.*,
                ds.title as derived_work_title, ds.author_id as derived_author_id,
                dw.title as original_work_title, dw.author_id as original_author_id
         FROM derivative_relations dr
         LEFT JOIN stories ds ON dr.derived_work_id = ds.id AND dr.derived_work_type = 'story'
         LEFT JOIN stories dw ON dr.original_work_id = dw.id AND dr.original_work_type = 'story'
         WHERE dr.derived_work_id = ? AND dr.derived_work_type = 'story'`,
        workId
      );

      derivedRelations = await db.all(
        `SELECT dr.*,
                ds.title as derived_work_title, ds.author_id as derived_author_id,
                dw.title as original_work_title, dw.author_id as original_author_id
         FROM derivative_relations dr
         LEFT JOIN stories ds ON dr.derived_work_id = ds.id AND dr.derived_work_type = 'story'
         LEFT JOIN stories dw ON dr.original_work_id = dw.id AND dr.original_work_type = 'story'
         WHERE dr.original_work_id = ? AND dr.original_work_type = 'story'`,
        workId
      );
    } else if (workType === "character") {
      originalRelations = await db.all(
        `SELECT dr.*,
                dc.name as derived_work_title, dc.author_id as derived_author_id,
                dwc.name as original_work_title, dwc.author_id as original_author_id
         FROM derivative_relations dr
         LEFT JOIN characters dc ON dr.derived_work_id = dc.id AND dr.derived_work_type = 'character'
         LEFT JOIN characters dwc ON dr.original_work_id = dwc.id AND dr.original_work_type = 'character'
         WHERE dr.derived_work_id = ? AND dr.derived_work_type = 'character'`,
        workId
      );

      derivedRelations = await db.all(
        `SELECT dr.*,
                dc.name as derived_work_title, dc.author_id as derived_author_id,
                dwc.name as original_work_title, dwc.author_id as original_author_id
         FROM derivative_relations dr
         LEFT JOIN characters dc ON dr.derived_work_id = dc.id AND dr.derived_work_type = 'character'
         LEFT JOIN characters dwc ON dr.original_work_id = dwc.id AND dr.original_work_type = 'character'
         WHERE dr.original_work_id = ? AND dr.original_work_type = 'character'`,
        workId
      );
    } else if (workType === "world") {
      originalRelations = await db.all(
        `SELECT dr.*,
                dw.name as derived_work_title, dw.author_id as derived_author_id,
                dww.name as original_work_title, dww.author_id as original_author_id
         FROM derivative_relations dr
         LEFT JOIN worlds dw ON dr.derived_work_id = dw.id AND dr.derived_work_type = 'world'
         LEFT JOIN worlds dww ON dr.original_work_id = dww.id AND dr.original_work_type = 'world'
         WHERE dr.derived_work_id = ? AND dr.derived_work_type = 'world'`,
        workId
      );

      derivedRelations = await db.all(
        `SELECT dr.*,
                dw.name as derived_work_title, dw.author_id as derived_author_id,
                dww.name as original_work_title, dww.author_id as original_author_id
         FROM derivative_relations dr
         LEFT JOIN worlds dw ON dr.derived_work_id = dw.id AND dr.derived_work_type = 'world'
         LEFT JOIN worlds dww ON dr.original_work_id = dww.id AND dr.original_work_type = 'world'
         WHERE dr.original_work_id = ? AND dr.original_work_type = 'world'`,
        workId
      );
    }

    const formatRelation = (r: Record<string, unknown>) => ({
      id: r.id,
      derivedWorkType: r.derived_work_type,
      derivedWorkId: r.derived_work_id,
      derivedWorkTitle: r.derived_work_title,
      derivedWorkAuthor: r.derived_author_id,
      originalWorkType: r.original_work_type,
      originalWorkId: r.original_work_id,
      originalWorkTitle: r.original_work_title,
      originalWorkAuthor: r.original_author_id,
      relationType: r.relation_type,
      note: r.note,
      createdAt: r.created_at,
    });

    return NextResponse.json({
      code: 200,
      data: {
        workId,
        workType,
        originalRelations: originalRelations.map((r) => formatRelation(r)),
        derivedRelations: derivedRelations.map((r) => formatRelation(r)),
      },
      msg: "获取成功",
    });
  } catch (error) {
    console.error("Get derivative relations error:", error);
    return NextResponse.json(
      { code: 500, msg: "获取失败" },
      { status: 500 }
    );
  }
}
