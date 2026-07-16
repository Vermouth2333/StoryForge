"use client";

import { App } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  emptyTargetReviewData,
  fetchTargetReviews,
  type TargetReviewData,
} from "@/lib/target-reviews";

type TargetReviewSectionProps = {
  targetType: "story" | "character" | "world";
  targetId: string;
  currentUserId?: string;
};

function renderStars(
  rating: number,
  interactive = false,
  onSelect?: (value: number) => void,
) {
  return Array.from({ length: 5 }, (_, i) => (
    <span
      key={i}
      className={`text-xl ${interactive ? "cursor-pointer" : ""} ${
        i < rating ? "text-yellow-400" : "text-gray-300"
      }`}
      onClick={() => interactive && onSelect?.(i + 1)}
    >
      ★
    </span>
  ));
}

export default function TargetReviewSection({
  targetType,
  targetId,
  currentUserId,
}: TargetReviewSectionProps) {
  const { message } = App.useApp();
  const [reviews, setReviews] = useState<TargetReviewData>(emptyTargetReviewData());
  const [userRating, setUserRating] = useState(5);
  const [userReviewText, setUserReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadReviews = useCallback(async () => {
    if (!targetId) return;
    const data = await fetchTargetReviews(targetType, targetId);
    setReviews(data);
    if (data.user_review) {
      setUserRating(data.user_review.rating);
      setUserReviewText(data.user_review.content ?? "");
    }
    setLoading(false);
  }, [targetType, targetId]);

  useEffect(() => {
    setLoading(true);
    void loadReviews();
  }, [loadReviews]);

  async function handleSubmitReview() {
    if (userRating === 0) {
      message.warning("请先选择评分");
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          rating: userRating,
          content: userReviewText,
        }),
      });
      const json = await res.json();
      if (json.code === 200) {
        message.success(json.msg ?? "评价已提交");
        await loadReviews();
      } else {
        message.error(json.msg ?? json.error ?? "评价提交失败");
      }
    } catch (error) {
      console.error("评价失败", error);
      message.error("评价提交失败");
    } finally {
      setSubmittingReview(false);
    }
  }

  const hasUserReview = !!reviews.user_review;

  return (
    <div className="mb-6 rounded-xl border border-[#DCE9FF] bg-white p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[#1F2A44]">
          <span>⭐</span> 评价
        </h3>
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold text-[#5B9DFF]">
            {reviews.stats.avg_rating ? reviews.stats.avg_rating.toFixed(1) : "0.0"}
          </div>
          <div>
            <div className="flex">{renderStars(Math.round(reviews.stats.avg_rating || 0))}</div>
            <p className="mt-0.5 text-xs text-[#5B6B8C]">
              {reviews.stats.total_count} 条评价
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 border-t border-[#DCE9FF] pt-4">
        <p className="mb-2 text-sm text-[#5B6B8C]">
          {hasUserReview ? "更新你的评价" : "写下你的评价"}
        </p>
        <div className="mb-3 flex items-center gap-2">
          {renderStars(userRating, true, setUserRating)}
        </div>
        <textarea
          value={userReviewText}
          onChange={(e) => setUserReviewText(e.target.value)}
          placeholder="分享你的想法（可选）..."
          className="sf-input mb-3 resize-none"
          rows={3}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void handleSubmitReview()}
          disabled={submittingReview || userRating === 0}
          className="sf-btn-primary disabled:opacity-50"
        >
          {submittingReview ? "提交中..." : hasUserReview ? "更新评价" : "提交评价"}
        </button>
      </div>

      <div className="border-t border-[#DCE9FF] pt-4">
        {loading ? (
          <p className="text-sm text-[#5B6B8C]">加载中...</p>
        ) : reviews.reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.reviews.map((review) => {
              const isMine = !!currentUserId && review.user_id === currentUserId;
              return (
                <div key={review.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5B9DFF] to-[#7FB4FF] text-sm font-bold text-white">
                    {review.username?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[#1F2A44]">
                        {review.username || "用户"}
                      </span>
                      {isMine && <span className="sf-tag text-xs">我的</span>}
                      <div className="flex text-sm">{renderStars(review.rating)}</div>
                    </div>
                    {review.content ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#5B6B8C]">
                        {review.content}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-[#5B6B8C]">（仅评分）</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[#5B6B8C]">暂无评价</p>
        )}
      </div>
    </div>
  );
}
