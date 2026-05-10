import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const params_data = await params;
  const { assetId } = params_data;
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "file"; // file/thumbnail
  
  const db = await getDb();
  const asset = await db.get("SELECT * FROM assets WHERE id = ?", [assetId]);
  
  if (!asset) {
    return NextResponse.json({ error: "资源不存在" }, { status: 404 });
  }
  
  const filePath = type === "thumbnail" && asset.thumbnail_path 
    ? path.join(process.cwd(), "storage", asset.thumbnail_path)
    : path.join(process.cwd(), "storage", asset.file_path);
  
  try {
    const fileBuffer = await readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": asset.mime_type,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("文件读取失败:", error);
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const params_data = await params;
  const userId = (await import("@/lib/auth")).getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  
  const { assetId } = params_data;
  const db = await getDb();
  
  const asset = await db.get("SELECT * FROM assets WHERE id = ? AND user_id = ?", [assetId, userId]);
  if (!asset) {
    return NextResponse.json({ error: "资源不存在或无权删除" }, { status: 404 });
  }
  
  // 从数据库删除记录
  await db.run("DELETE FROM assets WHERE id = ?", [assetId]);
  
  return NextResponse.json({ success: true });
}
