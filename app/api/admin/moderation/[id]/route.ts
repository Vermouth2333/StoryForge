import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth";
import { isAdminUser, parseAdminUserIds } from "@/lib/admin-auth";
import {
  adminForceTakeDown,
  logModerationDecision,
} from "@/lib/moderation-queue";
import { getDb, nowIso } from "@/lib/db";

const patchSchema = z.object({
  status: z.enum(["approved", "taken_down", "rejected"]),
  audit_remark: z.string().max(2000).optional().default(""),
});

/** PATCH — 处理单条审核 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const adminId = await getCurrentUserId();
  if (!adminId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  if (parseAdminUserIds().length === 0) {
    return NextResponse.json(
      { code: 503, msg: "未配置 STORYFORGE_ADMIN_USER_IDS" },
      { status: 503 },
    );
  }
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ code: 403, msg: "需要管理员权限" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const db = await getDb();
  const row = await db.get<{
    id: string;
    content_type: string;
    target_id: string;
    status: string;
  }>("SELECT id, content_type, target_id, status FROM moderation_items WHERE id = ?", itemId);

  if (!row) {
    return NextResponse.json({ code: 404, msg: "记录不存在" }, { status: 404 });
  }

  const ts = nowIso();
  if (parsed.data.status === "taken_down") {
    await adminForceTakeDown(db, row.content_type, row.target_id);
  }

  await db.run(
    `UPDATE moderation_items
     SET status = ?, audit_remark = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
     WHERE id = ?`,
    parsed.data.status,
    parsed.data.audit_remark,
    adminId,
    ts,
    ts,
    itemId,
  );

  await logModerationDecision(adminId, itemId, parsed.data.status, {
    content_type: row.content_type,
    target_id: row.target_id,
    audit_remark: parsed.data.audit_remark,
  });

  return NextResponse.json({ code: 200, msg: "已更新", data: { updated_at: ts } });
}
