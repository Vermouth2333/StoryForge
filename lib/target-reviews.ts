export type TargetReviewItem = {
  id: string;
  user_id: string;
  username?: string;
  rating: number;
  content?: string | null;
  created_at: string;
  updated_at?: string;
};

export type TargetReviewData = {
  stats: { avg_rating: number; total_count: number };
  reviews: TargetReviewItem[];
  user_review: { rating: number; content?: string | null } | null;
};

export function emptyTargetReviewData(): TargetReviewData {
  return {
    stats: { avg_rating: 0, total_count: 0 },
    reviews: [],
    user_review: null,
  };
}

function normalizeTargetReviewData(raw: Record<string, unknown>): TargetReviewData {
  const stats = (raw.stats as Record<string, unknown> | undefined) ?? {};
  const reviews = Array.isArray(raw.reviews) ? (raw.reviews as TargetReviewItem[]) : [];
  const userReview = (raw.user_review as TargetReviewData["user_review"]) ?? null;
  return {
    stats: {
      avg_rating: Number(stats.avg_rating) || 0,
      total_count: Number(stats.total_count) || 0,
    },
    reviews,
    user_review: userReview,
  };
}

export async function fetchTargetReviews(
  targetType: string,
  targetId: string,
): Promise<TargetReviewData> {
  const params = new URLSearchParams({
    target_type: targetType,
    target_id: targetId,
    _t: String(Date.now()),
  });
  const res = await fetch(`/api/reviews?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    return emptyTargetReviewData();
  }
  const json = (await res.json()) as Record<string, unknown>;
  return normalizeTargetReviewData(json);
}
