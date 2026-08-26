export const MINE_PAGE_SIZE = 5;

export function parseMineListParams(url: URL): {
  q: string;
  page: number;
  pageSize: number;
  offset: number;
  paginated: boolean;
} {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const paginated = url.searchParams.has("page") || url.searchParams.has("page_size");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const fallback = paginated ? MINE_PAGE_SIZE : 100;
  const raw = Number(url.searchParams.get("page_size") ?? String(fallback));
  const pageSize = Math.min(100, Math.max(1, raw || fallback));
  return { q, page, pageSize, offset: (page - 1) * pageSize, paginated };
}

export function likeContains(q: string): string {
  return `%${q.replace(/[%_\\]/g, "")}%`;
}
