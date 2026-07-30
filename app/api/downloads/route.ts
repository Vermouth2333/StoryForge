import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { downloadWorkSnapshot, type DownloadWorkType } from "@/lib/work-download";

const schema = z.object({
  work_type: z.enum(["character", "world", "story"]),
  work_id: z.string().min(1),
});

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const db = await getDb();
  const rows = await db.all(
    `SELECT id, work_type, source_work_id, local_work_id, source_version, cost, created_at
     FROM work_downloads
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 200`,
    userId,
  );
  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }
  const db = await getDb();
  const result = await downloadWorkSnapshot(
    db,
    userId,
    parsed.data.work_type as DownloadWorkType,
    parsed.data.work_id,
  );
  if (!result.ok) {
    return NextResponse.json({ code: result.status, msg: result.msg }, { status: result.status });
  }
  return NextResponse.json({
    code: 200,
    msg: result.alreadyHad ? "已下载过该版本，已定位到本地副本" : "下载成功（免费）",
    data: {
      local_work_id: result.localWorkId,
      source_version: result.sourceVersion,
      already_had: result.alreadyHad,
      download_cost: 0,
      is_free: true,
    },
  });
}
