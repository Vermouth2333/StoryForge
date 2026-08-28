import type { Database } from "sqlite";

export type StatsRange = "day" | "month" | "year";

export type StatsTotals = {
  downloads: number;
  reads: number;
  likes: number;
  follows: number;
  favorites: number;
};

export type StatsBucket = {
  label: string;
  downloads: number;
  reads: number;
  likes: number;
  follows: number;
  favorites: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function utcDayStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function periodBounds(range: StatsRange, now = new Date()): { start: string; end: string } {
  if (range === "day") {
    const start = utcDayStart(now);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (range === "month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function seriesWindows(range: StatsRange, now = new Date()): Array<{ label: string; start: string; end: string }> {
  const windows: Array<{ label: string; start: string; end: string }> = [];
  if (range === "day") {
    for (let i = 6; i >= 0; i--) {
      const start = utcDayStart(now);
      start.setUTCDate(start.getUTCDate() - i);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      windows.push({
        label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }
    return windows;
  }
  if (range === "month") {
    for (let i = 5; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      windows.push({
        label: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`,
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }
    return windows;
  }
  for (let i = 3; i >= 0; i--) {
    const year = now.getUTCFullYear() - i;
    windows.push({
      label: String(year),
      start: new Date(Date.UTC(year, 0, 1)).toISOString(),
      end: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
    });
  }
  return windows;
}

async function countDistinct(
  db: Database,
  sql: string,
  params: unknown[],
): Promise<number> {
  const row = await db.get<{ n: number }>(sql, ...params);
  return Number(row?.n ?? 0);
}

async function queryTotals(
  db: Database,
  authorId: string,
  start: string,
  end: string,
): Promise<StatsTotals> {
  const range = [start, end];
  const authors = [authorId, authorId, authorId];

  const downloads = await countDistinct(
    db,
    `SELECT COUNT(DISTINCT wd.user_id) AS n
     FROM work_downloads wd
     WHERE wd.created_at >= ? AND wd.created_at < ?
       AND (
         (wd.work_type = 'story' AND wd.source_work_id IN (SELECT id FROM stories WHERE author_id = ?))
         OR (wd.work_type = 'character' AND wd.source_work_id IN (SELECT id FROM characters WHERE author_id = ?))
         OR (wd.work_type = 'world' AND wd.source_work_id IN (SELECT id FROM worlds WHERE author_id = ?))
       )`,
    [...range, authorId, authorId, authorId],
  );

  const reads = await countDistinct(
    db,
    `SELECT COUNT(DISTINCT cs.user_id) AS n
     FROM chat_sessions cs
     WHERE cs.created_at >= ? AND cs.created_at < ?
       AND cs.user_id != ?
       AND (
         (cs.story_id IS NOT NULL AND cs.story_id IN (SELECT id FROM stories WHERE author_id = ?))
         OR (cs.character_id IS NOT NULL AND cs.character_id IN (SELECT id FROM characters WHERE author_id = ?))
         OR (cs.world_id IS NOT NULL AND cs.world_id IN (SELECT id FROM worlds WHERE author_id = ?))
       )`,
    [...range, authorId, authorId, authorId, authorId],
  );

  const likes = await countDistinct(
    db,
    `SELECT COUNT(DISTINCT l.user_id) AS n
     FROM likes l
     WHERE l.created_at >= ? AND l.created_at < ?
       AND (
         (l.target_type = 'story' AND l.target_id IN (SELECT id FROM stories WHERE author_id = ?))
         OR (l.target_type = 'character' AND l.target_id IN (SELECT id FROM characters WHERE author_id = ?))
         OR (l.target_type = 'world' AND l.target_id IN (SELECT id FROM worlds WHERE author_id = ?))
       )`,
    [...range, ...authors],
  );

  const follows = await countDistinct(
    db,
    `SELECT COUNT(DISTINCT user_id) AS n
     FROM follows
     WHERE author_id = ? AND created_at >= ? AND created_at < ?`,
    [authorId, ...range],
  );

  const favorites = await countDistinct(
    db,
    `SELECT COUNT(DISTINCT f.user_id) AS n
     FROM favorites f
     WHERE f.created_at >= ? AND f.created_at < ?
       AND (
         (f.target_type = 'story' AND f.target_id IN (SELECT id FROM stories WHERE author_id = ?))
         OR (f.target_type = 'character' AND f.target_id IN (SELECT id FROM characters WHERE author_id = ?))
         OR (f.target_type = 'world' AND f.target_id IN (SELECT id FROM worlds WHERE author_id = ?))
       )`,
    [...range, ...authors],
  );

  return { downloads, reads, likes, follows, favorites };
}

export async function getCreatorStats(
  db: Database,
  authorId: string,
  range: StatsRange,
) {
  const bounds = periodBounds(range);
  const totals = await queryTotals(db, authorId, bounds.start, bounds.end);
  const windows = seriesWindows(range);
  const series: StatsBucket[] = [];
  for (const w of windows) {
    const t = await queryTotals(db, authorId, w.start, w.end);
    series.push({ label: w.label, ...t });
  }
  return { range, start: bounds.start, end: bounds.end, totals, series };
}
