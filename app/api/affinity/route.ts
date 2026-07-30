import { NextResponse } from "next/server";
import { z } from "zod";
import { affinityStage, getAffinity } from "@/lib/affinity";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

const querySchema = z.object({
  character_id: z.string().min(1),
  story_id: z.string().optional(),
});

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    character_id: url.searchParams.get("character_id") ?? "",
    story_id: url.searchParams.get("story_id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const db = await getDb();
  const data = await getAffinity(db, userId, parsed.data.character_id, parsed.data.story_id);
  return NextResponse.json({ code: 200, data, msg: "ok" });
}

/** 故事内批量查询各 NPC 好感（可选） */
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const body = await req.json();
  const schema = z.object({
    story_id: z.string().optional(),
    character_ids: z.array(z.string().min(1)).min(1).max(50),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const db = await getDb();
  const items: Record<string, ReturnType<typeof affinityStage>> = {};
  for (const cid of parsed.data.character_ids) {
    items[cid] = await getAffinity(db, userId, cid, parsed.data.story_id);
  }
  return NextResponse.json({ code: 200, data: items, msg: "ok" });
}
