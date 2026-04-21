import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { persistUserAvatar } from "@/lib/avatar-storage";
import { getDb, nowIso } from "@/lib/db";
import { ensureUserRow } from "@/lib/user";
import { getRequestIp, rateLimitAllow } from "@/lib/rate-limit";

/** POST multipart/form-data，字段名 `file`，仅 JPG/PNG，≤5MB */
export async function POST(req: Request) {
  const userId = await getCurrentUserId();

  const rl = rateLimitAllow(`avatar_upload:${userId}`, 40, 3_600_000);
  if (!rl.ok) {
    return NextResponse.json(
      { code: 429, msg: "头像上传过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }
  const rlIp = rateLimitAllow(`avatar_upload_ip:${getRequestIp(req)}`, 120, 3_600_000);
  if (!rlIp.ok) {
    return NextResponse.json(
      { code: 429, msg: "当前网络上传过于频繁" },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ code: 400, msg: "无效表单" }, { status: 400 });
  }

  const entry = form.get("file");
  if (!entry || typeof entry === "string" || !("arrayBuffer" in entry)) {
    return NextResponse.json({ code: 400, msg: "请上传文件字段 file" }, { status: 400 });
  }

  const mime = entry.type?.toLowerCase() ?? "";
  if (!mime.includes("jpeg") && !mime.includes("jpg") && !mime.includes("png")) {
    return NextResponse.json({ code: 400, msg: "仅支持 JPG / PNG" }, { status: 400 });
  }

  const buf = Buffer.from(await entry.arrayBuffer());

  let avatarUrl: string;
  try {
    ({ avatarUrl } = await persistUserAvatar(userId, buf));
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "FILE_TOO_LARGE") {
      return NextResponse.json({ code: 400, msg: "文件须 ≤ 5MB" }, { status: 400 });
    }
    if (code === "UNSUPPORTED_IMAGE") {
      return NextResponse.json({ code: 400, msg: "无法识别的图片格式（需 JPG/PNG）" }, { status: 400 });
    }
    if (code === "INVALID_USER_ID") {
      return NextResponse.json({ code: 400, msg: "用户标识无效" }, { status: 400 });
    }
    console.error("[avatar]", e);
    return NextResponse.json({ code: 500, msg: "保存失败" }, { status: 500 });
  }

  const db = await getDb();
  await ensureUserRow(db, userId);
  await db.run("UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?", avatarUrl, nowIso(), userId);

  return NextResponse.json({
    code: 200,
    msg: "头像已更新",
    data: { avatar_url: avatarUrl },
  });
}
