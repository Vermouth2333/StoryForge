import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { executeAccountDeletion, isUserDeleted } from "@/lib/account-deletion";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";
import { verifyReplayGuard } from "@/lib/anti-replay";

const bodySchema = z.object({
  confirm: z.string().trim().pipe(z.literal("确认注销")),
  /** anonymize_published：已发布内容保留，作者展示为「已注销用户」；remove_all：下架并删除全部作品/角色/世界 */
  works_action: z.enum(["anonymize_published", "remove_all"]),
});

const DEMO_ID = "demo_user_google_123456";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();

  if (userId === DEMO_ID) {
    return NextResponse.json({ code: 400, msg: "演示账号不可注销" }, { status: 400 });
  }

  const rl = rateLimitAllow(`account_delete:${userId}`, 5, 3_600_000);
  if (!rl.ok) {
    return NextResponse.json({ code: 429, msg: "注销请求过于频繁，请稍后再试" }, { status: 429 });
  }
  const rlIp = rateLimitAllow(`account_delete_ip:${getRequestIp(req)}`, 10, 3_600_000);
  if (!rlIp.ok) {
    return NextResponse.json({ code: 429, msg: "当前网络请求过于频繁" }, { status: 429 });
  }

  const replay = await verifyReplayGuard(req, userId);
  if (!replay.ok) {
    return NextResponse.json({ code: replay.status, msg: replay.msg }, { status: replay.status });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 400, msg: "需输入确认文案「确认注销」并选择作品处理方式" },
      { status: 400 },
    );
  }

  const db = await getDb();
  if (await isUserDeleted(db, userId)) {
    return NextResponse.json({ code: 410, msg: "账号已注销" }, { status: 410 });
  }

  await executeAccountDeletion(db, userId, parsed.data.works_action);

  const res = NextResponse.json({
    code: 200,
    msg: "账号已注销",
    data: { works_action: parsed.data.works_action },
  });

  const c = await cookies();
  c.delete("sf_session");
  c.delete("sf_user_id");

  return res;
}
