import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { CREDIT_COSTS, CREDIT_PACKAGES, getCreditBalance } from "@/lib/credits";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }
  const balance = await getCreditBalance(userId);
  return NextResponse.json({
    code: 200,
    data: {
      balance,
      costs: CREDIT_COSTS,
      packages: CREDIT_PACKAGES,
    },
  });
}
