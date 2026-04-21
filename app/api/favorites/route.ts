import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  const userId = await getCurrentUserId();
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));

  const db = await getDb();
  const rows = await db.all(
    `SELECT
       f.id AS favorite_row_id,
       f.target_type,
       f.target_id,
       f.created_at,
       CASE f.target_type
         WHEN 'story' THEN s.title
         WHEN 'character' THEN c.name
         WHEN 'world' THEN w.name
       END AS title,
       CASE f.target_type
         WHEN 'story' THEN s.summary
         WHEN 'character' THEN c.summary
         WHEN 'world' THEN w.summary
       END AS summary,
       CASE f.target_type
         WHEN 'story' THEN s.author_id
         WHEN 'character' THEN c.author_id
         WHEN 'world' THEN w.author_id
       END AS author_id
     FROM favorites f
     LEFT JOIN stories s ON f.target_type = 'story' AND f.target_id = s.id
     LEFT JOIN characters c ON f.target_type = 'character' AND f.target_id = c.id
     LEFT JOIN worlds w ON f.target_type = 'world' AND f.target_id = w.id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC
     LIMIT ?`,
    userId,
    limit,
  );

  return NextResponse.json({ code: 200, data: rows, msg: "ok" });
}
