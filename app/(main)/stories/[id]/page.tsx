"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type StoryDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  title: string;
  summary: string;
  status: string;
  tags_json: string;
  like_count: number;
  favorite_count: number;
  publish_at: string | null;
  updated_at: string;
};

type CharacterRelation = {
  id: string;
  character_left_id: string;
  character_right_id: string;
  character_left_name: string;
  character_right_name: string;
  relation_type: string;
  description: string;
};

type Comment = {
  id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  like_count: number;
  reply_count: number;
  username: string;
  avatar_url: string;
  created_at: string;
  liked: boolean;
  replies: Comment[];
};

type ReviewData = {
  stats: { avg_rating: number; total_count: number };
  reviews: { id: string; username?: string; rating: number; content?: string }[];
  user_review: { rating: number; content?: string } | null;
};

export default function StoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [relations, setRelations] = useState<CharacterRelation[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [newComment, setNewComment] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [userReviewText, setUserReviewText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    void (async () => {
      const storyId = params.id;
      if (!storyId) return;
      
      const [storyRes, relationsRes, commentsRes, reviewsRes] = await Promise.all([
        fetch(`/api/stories/${storyId}`),
        fetch(`/api/stories/${storyId}/relations`),
        fetch(`/api/comments?target_type=story&target_id=${storyId}`),
        fetch(`/api/reviews?target_type=story&target_id=${storyId}`),
      ]);
      
      const storyJson = await storyRes.json();
      if (storyJson.code === 200) {
        setStory(storyJson.data);
      } else {
        setError(storyJson.msg ?? "加载失败");
      }
      
      const relationsJson = await relationsRes.json();
      if (relationsJson.code === 200) {
        setRelations(relationsJson.data?.relations ?? []);
      }
      
      if (commentsRes.ok) {
        const commentsJson = await commentsRes.json();
        setComments(commentsJson.comments ?? []);
      }
      
      if (reviewsRes.ok) {
        const reviewsJson = await reviewsRes.json();
        setReviews(reviewsJson);
        if (reviewsJson.user_review) {
          setUserRating(reviewsJson.user_review.rating);
          setUserReviewText(reviewsJson.user_review.content ?? "");
        }
      }
      
      setLoading(false);
    })();
  }, [params.id]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmittingComment(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "story",
          target_id: params.id,
          content: newComment,
        }),
      });
      
      if (res.ok) {
        setNewComment("");
        const commentsRes = await fetch(`/api/comments?target_type=story&target_id=${params.id}`);
        if (commentsRes.ok) {
          const commentsJson = await commentsRes.json();
          setComments(commentsJson.comments ?? []);
        }
      }
    } catch (error) {
      console.error("评论失败", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitReview = async () => {
    if (userRating === 0) return;
    
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "story",
          target_id: params.id,
          rating: userRating,
          content: userReviewText,
        }),
      });
      
      if (res.ok) {
        const reviewsRes = await fetch(`/api/reviews?target_type=story&target_id=${params.id}`);
        if (reviewsRes.ok) {
          const reviewsJson = await reviewsRes.json();
          setReviews(reviewsJson);
          if (reviewsJson.user_review) {
            setUserRating(reviewsJson.user_review.rating);
            setUserReviewText(reviewsJson.user_review.content ?? "");
          }
        }
      }
    } catch (error) {
      console.error("评分失败", error);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: "POST",
      });
      
      if (res.ok) {
        const result = await res.json();
        setComments(prev => prev.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              liked: result.liked,
              like_count: comment.like_count + (result.liked ? 1 : -1),
            };
          }
          return comment;
        }));
      }
    } catch (error) {
      console.error("点赞失败", error);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-[#5B6B8C]">加载中...</main>;
  }
  if (!story) {
    return (
      <main className="mx-auto max-w-4xl p-6 text-sm text-[#5B6B8C]">
        {error || "故事不存在"}
      </main>
    );
  }

  let tags: string[] = [];
  try {
    tags = JSON.parse(story.tags_json) as string[];
  } catch {
    tags = [];
  }

  const renderStars = (rating: number, interactive = false) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-xl ${interactive ? "cursor-pointer" : ""} ${
          i < rating ? "text-yellow-400" : "text-gray-300"}`}
        onClick={() => interactive && setUserRating(i + 1)}
      >
        ★
      </span>
    ));
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      {/* 故事信息卡片 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1F2A44]">{story.title}</h1>
            <p className="mt-2 text-sm text-[#5B6B8C] max-w-md">{story.summary || "暂无简介"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/market" className="sf-tag">
              返回市场
            </Link>
            <Link href={`/stories/${story.id}/play`} className="sf-btn-primary">
              🎮 开始体验
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="sf-tag">{tag}</span>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{story.like_count}</p>
            <p className="text-xs text-[#5B6B8C]">点赞</p>
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{story.favorite_count}</p>
            <p className="text-xs text-[#5B6B8C]">收藏</p>
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{story.status}</p>
            <p className="text-xs text-[#5B6B8C]">状态</p>
          </div>
          <Link href={`/authors/${story.author_id}`} className="rounded-xl bg-[#F8FBFF] p-4 text-center hover:bg-[#EEF6FF] transition-colors">
            <p className="text-lg font-bold text-[#5B9DFF]">{story.author_display || "作者"}</p>
            <p className="text-xs text-[#5B6B8C]">创建者</p>
          </Link>
        </div>
      </div>

      {/* 角色关系图谱 */}
      {relations.length > 0 && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
            <span>🔗</span> 角色关系
          </h3>
          <div className="space-y-3">
            {relations.map((rel) => (
              <div
                key={rel.id}
                className="flex items-center justify-center gap-4 rounded-xl bg-[#F8FBFF] p-4"
              >
                <span className="font-medium text-[#1F2A44]">{rel.character_left_name}</span>
                <span className="text-2xl">↔️</span>
                <span className="sf-tag">{rel.relation_type}</span>
                <span className="font-medium text-[#1F2A44]">{rel.character_right_name}</span>
                {rel.description && (
                  <>
                    <span className="text-2xl">📝</span>
                    <span className="text-sm text-[#5B6B8C]">{rel.description}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作入口 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
          <span>📚</span> 更多操作
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href={`/stories/${story.id}/edit`}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#F8FBFF] p-4 hover:bg-[#EEF6FF] transition-colors"
          >
            <span className="text-xl">📖</span>
            <div className="text-left">
              <p className="font-medium text-[#1F2A44]">章节大纲</p>
              <p className="text-xs text-[#5B6B8C]">编辑故事章节结构</p>
            </div>
          </Link>
          <Link
            href={`/stories/${story.id}/play`}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#EEF6FF] p-4 hover:bg-[#E0F2FE] transition-colors"
          >
            <span className="text-xl">🎮</span>
            <div className="text-left">
              <p className="font-medium text-[#5B9DFF]">互动体验</p>
              <p className="text-xs text-[#5B6B8C]">选择角色开始冒险</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 评分区域 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
          <span>⭐</span> 评分与评价
        </h3>
        
        {reviews && (
          <div className="mb-4 p-4 bg-[#F8FBFF] rounded-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#5B9DFF]">
                  {reviews.stats.avg_rating ? reviews.stats.avg_rating.toFixed(1) : "0.0"}
                </div>
                <div className="flex justify-center">
                  {renderStars(Math.round(reviews.stats.avg_rating || 0))}
                </div>
                <div className="text-sm text-[#5B6B8C] mt-1">
                  共 {reviews.stats.total_count} 条评价
                </div>
              </div>
            </div>
            
            <div className="border-t border-[#DCE9FF] pt-4">
              <p className="text-sm text-[#5B6B8C] mb-2">分享你的评价</p>
              <div className="flex items-center gap-2 mb-3">
                {renderStars(userRating, true)}
              </div>
              <textarea
                value={userReviewText}
                onChange={(e) => setUserReviewText(e.target.value)}
                placeholder="写下你的评价（可选）..."
                className="sf-input mb-3 resize-none"
                rows={3}
              />
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview || userRating === 0}
                className="sf-btn-primary disabled:opacity-50"
              >
                {submittingReview ? "提交中..." : "提交评价"}
              </button>
            </div>
            
            {reviews.reviews.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[#DCE9FF]">
                <p className="text-sm text-[#5B6B8C] mb-3">其他用户评价</p>
                {reviews.reviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="mb-4 pb-4 border-b border-[#DCE9FF] last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                        {review.username?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <span className="text-sm font-medium text-[#1F2A44]">{review.username}</span>
                      <div className="flex">{renderStars(review.rating)}</div>
                    </div>
                    {review.content && (
                      <p className="text-sm text-[#5B6B8C] ml-10">{review.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 评论区 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6">
        <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
          <span>💬</span> 评论区 ({comments.length})
        </h3>
        
        {/* 发表评论 */}
        <div className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="发表你的评论..."
            className="sf-input mb-3 resize-none"
            rows={3}
          />
          <button
            onClick={handleSubmitComment}
            disabled={submittingComment || !newComment.trim()}
            className="sf-btn-primary disabled:opacity-50"
          >
            {submittingComment ? "发表中..." : "发表评论"}
          </button>
        </div>
        
        {/* 评论列表 */}
        {comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="border-b border-[#DCE9FF] pb-4 last:border-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {comment.username?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[#1F2A44]">{comment.username}</span>
                      <span className="text-xs text-[#5B6B8C]">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-[#1F2A44] mb-2">{comment.content}</p>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLikeComment(comment.id)}
                        className={`flex items-center gap-1 text-xs ${
                          comment.liked ? "text-red-500" : "text-[#5B6B8C]"
                        } hover:text-red-500`}
                      >
                        <span>{comment.liked ? "❤️" : "🤍"}</span>
                        <span>{comment.like_count}</span>
                      </button>
                      {comment.reply_count > 0 && (
                        <span className="text-xs text-[#5B6B8C]">
                          {comment.reply_count} 条回复
                        </span>
                      )}
                    </div>
                    
                    {/* 回复列表 */}
                    {comment.replies.length > 0 && (
                      <div className="mt-3 pl-4 space-y-3 border-l-2 border-[#DCE9FF]">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {reply.username?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm text-[#1F2A44]">{reply.username}</span>
                                <span className="text-xs text-[#5B6B8C]">
                                  {new Date(reply.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm text-[#1F2A44]">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[#5B6B8C]">
            暂无评论，来发表第一条吧！
          </div>
        )}
      </div>
    </main>
  );
}
