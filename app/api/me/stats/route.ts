import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getCreatorStats, type StatsRange } from "@/lib/creator-stats";

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ code: 401, msg: "未登录" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rangeRaw = url.searchParams.get("range") ?? "day";
  const range: StatsRange =
    rangeRaw === "month" || rangeRaw === "year" ? rangeRaw : "day";

  const db = await getDb();
  const data = await getCreatorStats(db, userId, range);
  return NextResponse.json({ code: 200, data });
}
