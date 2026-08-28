import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { code: 410, msg: "模型由平台统一提供，请使用积分" },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { code: 410, msg: "模型由平台统一提供，请使用积分" },
    { status: 410 },
  );
}
