import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isCrossSiteMutationBlocked } from "@/lib/origin-check";

export function middleware(req: NextRequest) {
  if (!isCrossSiteMutationBlocked(req)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    {
      code: 403,
      msg: "拒绝跨站变更请求（请从本站页面发起操作，或检查反向代理 Host/Origin 配置）",
    },
    { status: 403 },
  );
}

export const config = {
  matcher: "/api/:path*",
};
