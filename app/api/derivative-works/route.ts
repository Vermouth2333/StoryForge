import { getDb, id, nowIso } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const db = await getDb();
  const body = await request.json();
  const { derived_work_type, derived_work_id, original_work_type, original_work_id, relation_type, note } = body;
  
  if (!derived_work_type || !derived_work_id || !original_work_type || !original_work_id || !relation_type) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  
  // 检查是否是作品的作者
  let authorId = null;
  if (derived_work_type === "story") {
    const story = await db.get("SELECT author_id FROM stories WHERE id = ?", [derived_work_id]);
    authorId = story?.author_id;
  } else if (derived_work_type === "character") {
    const character = await db.get("SELECT author_id FROM characters WHERE id = ?", [derived_work_id]);
    authorId = character?.author_id;
  } else if (derived_work_type === "world") {
    const world = await db.get("SELECT author_id FROM worlds WHERE id = ?", [derived_work_id]);
    authorId = world?.author_id;
  }
  
  if (authorId !== userId) {
    return NextResponse.json({ error: "只能为自己的作品设置二创关系" }, { status: 403 });
  }
  
  const relationId = id("derivative");
  
  await db.run(
    `INSERT INTO derivative_relations (id, derived_work_type, derived_work_id, original_work_type, original_work_id, relation_type, note, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [relationId, derived_work_type, derived_work_id, original_work_type, original_work_id, relation_type, note || null, nowIso()]
  );
  
  return NextResponse.json({ id: relationId });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const work_type = searchParams.get("work_type");
  const work_id = searchParams.get("work_id");
  const direction = searchParams.get("direction") || "both"; // both, derived, original
  
  if (!work_type || !work_id) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  
  const db = await getDb();
  let derived = [];
  let original = [];
  
  // 获取以此作品为原作的作品（衍生作品）
  if (direction === "both" || direction === "derived") {
    derived = await db.all(
      `SELECT dr.* FROM derivative_relations dr 
       WHERE dr.original_work_type = ? AND dr.original_work_id = ? 
       ORDER BY dr.created_at DESC`,
      [work_type, work_id]
    );
    
    // 加载衍生作品信息
    derived = await Promise.all(derived.map(async (rel) => {
      let work = null;
      if (rel.derived_work_type === "story") {
        work = await db.get("SELECT id, title, summary, status FROM stories WHERE id = ?", [rel.derived_work_id]);
      } else if (rel.derived_work_type === "character") {
        work = await db.get("SELECT id, name, summary, status FROM characters WHERE id = ?", [rel.derived_work_id]);
      } else if (rel.derived_work_type === "world") {
        work = await db.get("SELECT id, name, summary, status FROM worlds WHERE id = ?", [rel.derived_work_id]);
      }
      return { ...rel, work };
    }));
  }
  
  // 获取此作品引用的原作
  if (direction === "both" || direction === "original") {
    original = await db.all(
      `SELECT dr.* FROM derivative_relations dr 
       WHERE dr.derived_work_type = ? AND dr.derived_work_id = ? 
       ORDER BY dr.created_at DESC`,
      [work_type, work_id]
    );
    
    // 加载原作信息
    original = await Promise.all(original.map(async (rel) => {
      let work = null;
      if (rel.original_work_type === "story") {
        work = await db.get("SELECT id, title, summary, status FROM stories WHERE id = ?", [rel.original_work_id]);
      } else if (rel.original_work_type === "character") {
        work = await db.get("SELECT id, name, summary, status FROM characters WHERE id = ?", [rel.original_work_id]);
      } else if (rel.original_work_type === "world") {
        work = await db.get("SELECT id, name, summary, status FROM worlds WHERE id = ?", [rel.original_work_id]);
      }
      return { ...rel, work };
    }));
  }
  
  return NextResponse.json({ derived, original });
}
