import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assertSafeUserIdForPath, userAvatarThumbPath } from "@/lib/avatar-storage";

/** 公开读取用户头像缩略图（200×200 JPEG） */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const { userId: raw } = await ctx.params;
  let userId = raw;
  try {
    userId = decodeURIComponent(raw);
  } catch {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  try {
    assertSafeUserIdForPath(userId);
  } catch {
    return NextResponse.json({ code: 400, msg: "参数错误" }, { status: 400 });
  }

  const thumb = userAvatarThumbPath(userId);
  try {
    const buf = await fs.readFile(thumb);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    const origDir = path.join(process.cwd(), "storage", "users", userId, "avatar", "original");
    try {
      const names = await fs.readdir(origDir);
      const latest = names.filter((n) => /\.(jpe?g|png)$/i.test(n)).sort().pop();
      if (!latest) {
        return NextResponse.json({ code: 404, msg: "无头像" }, { status: 404 });
      }
      const p = path.join(origDir, latest);
      const buf = await fs.readFile(p);
      const ct = /\.png$/i.test(latest) ? "image/png" : "image/jpeg";
      return new NextResponse(buf, {
        headers: {
          "Content-Type": ct,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      return NextResponse.json({ code: 404, msg: "无头像" }, { status: 404 });
    }
  }
}
