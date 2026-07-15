import { NextResponse } from "next/server";
import { serveAssetFile } from "@/lib/serve-asset";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const res = await serveAssetFile(assetId, "file");
  if (!res) {
    return NextResponse.json({ code: 404, msg: "文件不存在" }, { status: 404 });
  }
  return res;
}
