import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { isAdminUser, parseAdminUserIds } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

/** GET — 审核队列列表（管理员） */
export async function GET() {
  const userId = await getCurrentUserId();
  if (parseAdminUserIds().length === 0) {
    return NextResponse.json(
      { code: 503, msg: "未配置 STORYFORGE_ADMIN_USER_IDS，管理接口不可用" },
      { status: 503 },
    );
  }
  if (!isAdminUser(userId)) {
    return NextResponse.json({ code: 403, msg: "需要管理员权限" }, { status: 403 });
  }

  const db = await getDb();
  const rows = await db.all<
    {
      id: string;
      content_type: string;
      target_id: string;
      trigger_reason: string;
      submitter_user_id: string | null;
      status: string;
      audit_remark: string;
      reviewed_by: string | null;
      reviewed_at: string | null;
      created_at: string;
      updated_at: string;
    }[]
  >(
    `SELECT id, content_type, target_id, trigger_reason, submitter_user_id, status, audit_remark,
            reviewed_by, reviewed_at, created_at, updated_at
     FROM moderation_items
     ORDER BY datetime(created_at) DESC
     LIMIT 200`,
  );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}
