"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { message } from "antd";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

type CharacterDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  name: string;
  avatar_url: string | null;
  summary: string;
  personality: string;
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

type MessageItem = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
};

type ReviewData = {
  stats: { avg_rating: number; total_count: number };
  reviews: { id: string; username?: string; rating: number; content?: string }[];
  user_review: { rating: number; content?: string } | null;
};

export default function CharacterDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // 对话状态
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  
  // 评分状态
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [userReviewText, setUserReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;
      
      const [characterRes, reviewsRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch(`/api/reviews?target_type=character&target_id=${id}`),
      ]);
      
      const characterJson = await characterRes.json();
      if (characterJson.code === 200) {
        setRow(characterJson.data);
      } else {
        setError(characterJson.msg ?? "加载失败");
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

  async function createSession() {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "character",
        character_id: params.id,
        title: `与${row?.name}对话`,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setSessionId(json.data.session_id);
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || !sessionId) return;
    setBusy(true);
    setStreamText("");
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: MessageItem = {
      id: "temp",
      role: "user",
      content: inputMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputMessage }),
        signal: controller.signal,
      });
      if (!res.body) {
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as { type?: string; content?: string };
          if (payload.type === "content") {
            acc += payload.content;
            setStreamText(acc);
          }
        }
      }
      if (acc) {
        const assistantMsg: MessageItem = {
          id: "assistant_" + Date.now(),
          role: "assistant",
          content: acc,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
      setStreamText("");
    } catch (err: unknown) {
      const isAbort =
        (err as { name?: string })?.name === "AbortError" || err instanceof DOMException;
      if (isAbort) {
        setStreamText((cur) => {
          if (cur) {
            const assistantMsg: MessageItem = {
              id: "assistant_" + Date.now(),
              role: "assistant",
              content: cur + "\n\n（已停止生成）",
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }
          return "";
        });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }
  
  const handleSubmitReview = async () => {
    if (userRating === 0) return;
    
    setSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "character",
          target_id: params.id,
          rating: userRating,
          content: userReviewText,
        }),
      });
      
      if (res.ok) {
        message.success("评价提交成功");
        const reviewsRes = await fetch(`/api/reviews?target_type=character&target_id=${params.id}`);
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
      body: JSON.stringify({ target_type: "character", target_id: prev.id }),
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
      body: JSON.stringify({ target_type: "character", target_id: prev.id }),
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
        {error || "角色不存在"}
      </main>
    );
  }

  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags_json) as string[];
  } catch {
    tags = [];
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      {/* 角色信息卡片 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            {row.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.avatar_url}
                alt=""
                className="h-24 w-24 shrink-0 rounded-xl border-2 border-[#DCE9FF] object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#EEF6FF] to-[#E0F2FE] text-2xl font-bold text-[#5B9DFF]">
                {row.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-[#1F2A44]">{row.name}</h1>
              <p className="mt-2 text-sm text-[#5B6B8C] max-w-md">{row.summary || "暂无简介"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/market" className="sf-tag">
              返回市场
            </Link>
            {!sessionId ? (
              <button className="sf-btn-primary" onClick={createSession}>
                💬 开始对话
              </button>
            ) : null}
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
        </div>
      )}

      {/* 性格与设定 */}
      {row.personality && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2">
            <span>🎭</span> 性格与设定
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[#5B6B8C] leading-relaxed">
            {row.personality}
          </p>
        </div>
      )}

      {/* 对话区域 */}
      {sessionId && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
            <span>💬</span> 与 {row.name} 对话
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-4 ${
                  msg.role === "user"
                    ? "bg-[#EEF6FF] border-l-4 border-[#5B9DFF]"
                    : "bg-[#F0F9FF] border-l-4 border-[#4FACFE]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    msg.role === "user"
                      ? "bg-[#5B9DFF] text-white"
                      : "bg-[#4FACFE] text-white"
                  }`}>
                    {msg.role === "user" ? "我" : row.name}
                  </span>
                </div>
                <p className="text-sm text-[#1F2A44] leading-relaxed">{msg.content}</p>
              </div>
            ))}
            {streamText && (
              <div className="rounded-xl p-4 bg-[#F0F9FF] border-l-4 border-[#4FACFE]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#4FACFE] text-white">
                    {row.name}
                  </span>
                </div>
                <p className="text-sm text-[#1F2A44] leading-relaxed">{streamText}▌</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <input
              className="sf-input flex-1"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`与 ${row.name} 对话...`}
              disabled={busy}
            />
            <button className="sf-btn-primary" onClick={sendMessage} disabled={busy || !inputMessage.trim()}>
              {busy ? "发送中..." : "发送"}
            </button>
            {busy && (
              <button className="sf-btn-secondary" onClick={stopGeneration}>
                停止
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
