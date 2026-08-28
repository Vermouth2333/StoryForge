import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  return NextResponse.json(
    {
      code: 400,
      msg: "当前环境未开通在线支付，请联系开发者发放积分",
    },
    { status: 400 },
  );
}
