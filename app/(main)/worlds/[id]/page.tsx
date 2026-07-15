"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { App } from "antd";
import CoverUploader from "@/components/CoverUploader";
import AuthorWorkEditor from "@/components/AuthorWorkEditor";
import CoverDisplay from "@/components/CoverDisplay";
import { useWorkPageMode } from "@/hooks/use-work-page-mode";
import { useWorkConfirm } from "@/hooks/use-work-confirm";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

type WorldDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  name: string;
  cover_asset_id: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  summary: string;
  setting_notes: string;
  tags_json: string;
  status: string;
  like_count: number;
  favorite_count: number;
  publish_at: string | null;
  updated_at: string;
  liked_by_me?: boolean;
  favorited_by_me?: boolean;
  is_following?: boolean;
};

type KnowledgeEntry = {
  id: string;
  world_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ReviewData = {
  stats: { avg_rating: number; total_count: number };
  reviews: { id: string; username?: string; rating: number; content?: string }[];
  user_review: { rating: number; content?: string } | null;
};

export default function WorldDetailPage() {
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<WorldDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  // 评分状态
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [userRating, setUserRating] = useState(5);
  const [userReviewText, setUserReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const { canEdit } = useWorkPageMode(row?.author_id, meId);
  const { confirmDelete } = useWorkConfirm();

  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;
      
      const [worldRes, profileRes, reviewsRes] = await Promise.all([
        fetch(`/api/worlds/${id}`),
        fetch("/api/profile"),
        fetch(`/api/reviews?target_type=world&target_id=${id}`),
      ]);
      const worldJson = await worldRes.json();
      const profileJson = await profileRes.json();
      if (profileJson.code === 200 && profileJson.data?.id) {
        setMeId(String(profileJson.data.id));
      }
      if (worldJson.code === 200) {
        setRow(worldJson.data);
        const kr = await fetch(`/api/worlds/${id}/knowledge`);
        const kj = await kr.json();
        if (kj.code === 200) {
          setKnowledge(kj.data ?? []);
        } else {
          setKnowledge([]);
        }
      } else {
        setError(worldJson.msg ?? "加载失败");
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

  const handleSubmitReview = async () => {
    if (userRating === 0) return;

    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "world",
          target_id: params.id,
          rating: userRating,
          content: userReviewText,
        }),
      });
      
      if (res.ok) {
        message.success("评价提交成功");
        const reviewsRes = await fetch(`/api/reviews?target_type=world&target_id=${params.id}`);
        if (reviewsRes.ok) {
          const reviewsJson = await reviewsRes.json();
          setReviews(reviewsJson);
          if (reviewsJson.user_review) {
            setUserRating(reviewsJson.user_review.rating);
            setUserReviewText(reviewsJson.user_review.content ?? "");
          }
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        message.error(errJson.error || "提交评价失败，请先登录");
      }
    } catch (error) {
      console.error("评分失败", error);
      message.error("提交评价失败");
    } finally {
      setSubmittingReview(false);
    }
  };

  async function toggleLike() {
    if (!row) return;
    const prev = row;
    setRow({
      ...prev,
      liked_by_me: !prev.liked_by_me,
      like_count: prev.like_count + (prev.liked_by_me ? -1 : 1),
    });
    const res = await fetch("/api/likes/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "world", target_id: prev.id }),
    });
    const json = await res.json();
    if (json.code !== 200) {
      setRow(prev);
      message.error(json.msg ?? "操作失败");
    }
  }

  async function toggleFavorite() {
    if (!row) return;
    const prev = row;
    const nextFav = !prev.favorited_by_me;
    setRow({
      ...prev,
      favorited_by_me: nextFav,
      favorite_count: prev.favorite_count + (nextFav ? 1 : -1),
    });
    const res = await fetch("/api/favorites/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "world", target_id: prev.id }),
    });
    const json = await res.json();
    if (json.code === 200) {
      message.success(nextFav ? "已收藏" : "已取消收藏");
    } else {
      setRow(prev);
      message.error(json.msg ?? "操作失败");
    }
  }

  async function toggleFollow() {
    if (!row) return;
    const prev = row;
    const nextFollow = !prev.is_following;
    setRow({ ...prev, is_following: nextFollow });
    const res = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: prev.author_id }),
    });
    const json = await res.json();
    if (json.code === 200) {
      message.success(nextFollow ? "已关注" : "已取消关注");
    } else {
      setRow(prev);
      message.error(json.msg ?? "操作失败");
    }
  }

  function handleDelete() {
    if (!row || row.status === "published") return;
    confirmDelete("world", row.name, async () => {
      const res = await fetch(`/api/worlds/${row.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.code === 200) {
        message.success("已删除");
        router.push("/my");
      } else {
        message.error(json.msg ?? "删除失败");
      }
    });
  }

  const renderStars = (rating: number, interactive = false) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-xl ${interactive ? "cursor-pointer" : ""} ${
          i < rating ? "text-yellow-400" : "text-gray-300"
        }`}
        onClick={() => interactive && setUserRating(i + 1)}
      >
        ★
      </span>
    ));
  };

  if (loading) {
    return <main className="sf-loading" />;
  }
  if (!row) {
    return (
      <main className="mx-auto max-w-4xl p-6 text-sm text-[#5B6B8C]">
        {error || "世界不存在"}
      </main>
    );
  }

  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags_json) as string[];
  } catch {
    tags = [];
  }

  const world = row;

  async function reloadKnowledge() {
    const kr = await fetch(`/api/worlds/${world.id}/knowledge`);
    const kj = await kr.json();
    if (kj.code === 200) setKnowledge(kj.data ?? []);
  }

  async function addKnowledge() {
    const t = newTitle.trim();
    if (!t) return;
    const res = await fetch(`/api/worlds/${world.id}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, body: newBody }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setNewTitle("");
      setNewBody("");
      await reloadKnowledge();
    }
  }

  async function deleteEntry(entryId: string) {
    if (!window.confirm("确定删除该词条？")) return;
    const res = await fetch(`/api/worlds/${world.id}/knowledge/${entryId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.code === 200) await reloadKnowledge();
  }

  async function saveEdit(entryId: string) {
    if (!editTitle.trim()) return;
    const res = await fetch(`/api/worlds/${world.id}/knowledge/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), body: editBody }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setEditingId(null);
      await reloadKnowledge();
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      {/* 世界信息卡片 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1F2A44]">{row.name}</h1>
            <p className="mt-2 text-sm text-[#5B6B8C] max-w-md">{row.summary || "暂无简介"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/market" className="sf-tag">
              返回市场
            </Link>
            <Link href={`/worlds/${row.id}/chat`} className="sf-btn-primary">
              🌍 探索世界
            </Link>
            <button
              type="button"
              className={`sf-tag ${row.liked_by_me ? "!bg-[#5B9DFF] !text-white" : ""}`}
              onClick={() => void toggleLike()}
            >
              {row.liked_by_me ? "❤️ 已点赞" : "🤍 点赞"} ({row.like_count})
            </button>
            <button
              type="button"
              className={`sf-tag ${row.favorited_by_me ? "!bg-[#5B9DFF] !text-white" : ""}`}
              onClick={() => void toggleFavorite()}
            >
              {row.favorited_by_me ? "★ 已收藏" : "☆ 收藏"} ({row.favorite_count})
            </button>
            {row.author_id && (
              <button
                type="button"
                className={`sf-tag ${row.is_following ? "!bg-[#5B9DFF] !text-white" : ""}`}
                onClick={() => void toggleFollow()}
              >
                {row.is_following ? "已关注作者" : "＋ 关注作者"}
              </button>
            )}
            {canEdit && row.status !== "published" && (
              <button type="button" className="sf-tag !text-[#8B2E2E]" onClick={() => void handleDelete()}>
                删除
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="sf-tag">{tag}</span>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{row.like_count}</p>
            <p className="text-xs text-[#5B6B8C]">点赞</p>
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{row.favorite_count}</p>
            <p className="text-xs text-[#5B6B8C]">收藏</p>
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{STATUS_LABELS[row.status] ?? row.status}</p>
            <p className="text-xs text-[#5B6B8C]">状态</p>
          </div>
          <Link href={`/authors/${row.author_id}`} className="rounded-xl bg-[#F8FBFF] p-4 text-center hover:bg-[#EEF6FF] transition-colors">
            <p className="text-lg font-bold text-[#5B9DFF]">{row.author_display || "作者"}</p>
            <p className="text-xs text-[#5B6B8C]">创建者</p>
          </Link>
        </div>
      </div>

      {canEdit && (
        <AuthorWorkEditor
          kind="world"
          id={row.id}
          status={row.status}
          name={row.name}
          summary={row.summary}
          tagsJson={row.tags_json}
          settingNotes={row.setting_notes}
          onUpdated={(patch) => setRow((prev) => (prev ? { ...prev, ...patch } : prev))}
          onStatusChange={(st, publishAt) =>
            setRow((prev) =>
              prev
                ? {
                    ...prev,
                    status: st,
                    publish_at: publishAt !== undefined ? publishAt : prev.publish_at,
                  }
                : prev,
            )
          }
        />
      )}

      {/* 封面区域 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
          <span>🖼️</span> 封面图
        </h3>
        {canEdit ? (
          <CoverUploader
            endpoint={`/api/worlds/${row.id}/cover`}
            coverUrl={row.cover_url}
            thumbnailUrl={row.cover_thumbnail_url}
            onUploaded={(url) => setRow((prev) => prev ? { ...prev, cover_url: url } : prev)}
          />
        ) : row.cover_url ? (
          <CoverDisplay src={row.cover_url} alt={`${row.name} 封面`} />
        ) : (
          <p className="text-sm text-[#5B6B8C]">暂无封面</p>
        )}
      </div>

      {/* 评分区域 */}
      {reviews && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
            <span>⭐</span> 评分与评价
          </h3>
          
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
              <p className="text-xs text-[#5B6B8C] mb-2">分享你的评价</p>
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
                <p className="text-xs text-[#5B6B8C] mb-3">其他用户评价</p>
                {reviews.reviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="mb-4 pb-4 border-b border-[#DCE9FF] last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
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
        </div>
      )}

      {/* 世界设定 */}
      {row.setting_notes && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2">
            <span>📖</span> 世界设定
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[#5B6B8C] leading-relaxed">
            {row.setting_notes}
          </p>
        </div>
      )}

      {/* 知识库 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2">
          <span>📚</span> 知识库
        </h3>
        <p className="mt-1 text-xs text-[#5B6B8C]">
          词条用于补充规则、地理、势力等设定；已发布世界对访客可见。
        </p>
        {knowledge.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {knowledge.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-[#DCE9FF] bg-[#F8FBFF] p-4"
              >
                {editingId === e.id ? (
                  <div className="space-y-2">
                    <input
                      className="sf-input w-full text-sm"
                      value={editTitle}
                      onChange={(ev) => setEditTitle(ev.target.value)}
                    />
                    <textarea
                      className="sf-input min-h-[80px] w-full resize-y text-sm"
                      value={editBody}
                      onChange={(ev) => setEditBody(ev.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="sf-tag"
                        onClick={() => void saveEdit(e.id)}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="sf-tag"
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="font-medium text-[#1F2A44]">{e.title}</h4>
                      {canEdit ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="sf-tag text-xs"
                            onClick={() => {
                              setEditingId(e.id);
                              setEditTitle(e.title);
                              setEditBody(e.body);
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="sf-tag text-xs"
                            onClick={() => void deleteEntry(e.id)}
                          >
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {e.body && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#5B6B8C]">
                        {e.body}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center py-8">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm text-[#5B6B8C]">暂无词条</p>
          </div>
        )}
        {canEdit && (
          <div className="mt-6 border-t border-[#DCE9FF] pt-4">
            <p className="text-xs font-medium text-[#1F2A44]">新增词条</p>
            <input
              className="sf-input mt-2 w-full"
              placeholder="标题"
              value={newTitle}
              onChange={(ev) => setNewTitle(ev.target.value)}
            />
            <textarea
              className="sf-input mt-2 min-h-[100px] w-full resize-y"
              placeholder="正文（可选）"
              value={newBody}
              onChange={(ev) => setNewBody(ev.target.value)}
            />
            <button
              type="button"
              className="sf-btn-secondary mt-3"
              onClick={() => void addKnowledge()}
            >
              添加词条
            </button>
          </div>
        )}
      </div>

      {/* 对话入口 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-1">
              <span>🌍</span> 探索 {row.name}
            </h3>
            <p className="text-xs text-[#5B6B8C]">在新页面中开启对话并查看历史会话</p>
          </div>
          <Link href={`/worlds/${row.id}/chat`} className="sf-btn-primary">
            进入对话 →
          </Link>
        </div>
      </div>
    </main>
  );
}
