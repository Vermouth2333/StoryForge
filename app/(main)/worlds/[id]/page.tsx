"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type WorldDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  name: string;
  cover_asset_id: string | null;
  summary: string;
  setting_notes: string;
  tags_json: string;
  status: string;
  like_count: number;
  favorite_count: number;
  publish_at: string | null;
  updated_at: string;
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

type MessageItem = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
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
  reviews: any[];
  user_review: any;
};

export default function WorldDetailPage() {
  const params = useParams<{ id: string }>();
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
  
  // 对话状态
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  
  // 评论和评分状态
  const [comments, setComments] = useState<Comment[]>([]);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [newComment, setNewComment] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [userReviewText, setUserReviewText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;
      
      const [worldRes, profileRes, commentsRes, reviewsRes] = await Promise.all([
        fetch(`/api/worlds/${id}`),
        fetch("/api/profile"),
        fetch(`/api/comments?target_type=world&target_id=${id}`),
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

  async function createSession() {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "world",
        world_id: params.id,
        title: `探索${row?.name}`,
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
      });
      if (!res.body) {
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as any;
          if (payload.type === "content") {
            setStreamText((t) => t + payload.content);
          }
        }
      }
      if (streamText) {
        const assistantMsg: MessageItem = {
          id: "assistant_" + Date.now(),
          role: "assistant",
          content: streamText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => {
          const newList = [...prev];
          return [...newList.slice(0, -1), assistantMsg];
        });
      }
      setStreamText("");
    } finally {
      setBusy(false);
    }
  }
  
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmittingComment(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "world",
          target_id: params.id,
          content: newComment,
        }),
      });
      
      if (res.ok) {
        setNewComment("");
        const commentsRes = await fetch(`/api/comments?target_type=world&target_id=${params.id}`);
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
          target_type: "world",
          target_id: params.id,
          rating: userRating,
          content: userReviewText,
        }),
      });
      
      if (res.ok) {
        const reviewsRes = await fetch(`/api/reviews?target_type=world&target_id=${params.id}`);
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
        setComments((prev) => prev.map((comment) => {
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
    return <main className="mx-auto max-w-4xl p-6 text-sm text-[#5B6B8C]">加载中...</main>;
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

  const isAuthor = meId !== null && meId === row.author_id;
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
            {!sessionId ? (
              <button className="sf-btn-primary" onClick={createSession}>
                🌍 探索世界
              </button>
            ) : null}
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
            <p className="text-lg font-bold text-[#5B9DFF]">{row.status}</p>
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
              <p className="text-xs text-[#5B6B8C] mb-2">分享你的评价</p>
              <div className="flex items-center gap-2 mb-3">
                {renderStars(userRating, true)}
              </div>
              <textarea
                value={userReviewText}
                onChange={(e) => setUserReviewText(e.target.value)}
                placeholder="写下你的评价（可选）..."
                className="w-full p-3 border border-[#DCE9FF] rounded-xl text-sm mb-3 resize-none"
                rows={3}
              />
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview || userRating === 0}
                className="px-4 py-2 bg-[#5B9DFF] text-white rounded-xl text-sm font-medium hover:bg-[#4A8FEF] transition-colors disabled:opacity-50"
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
                      {isAuthor ? (
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
        {isAuthor && (
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

      {/* 对话区域 */}
      {sessionId && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
            <span>🌍</span> 探索 {row.name}
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
              placeholder={`探索 ${row.name} 的世界观...`}
              disabled={busy}
            />
            <button className="sf-btn-primary" onClick={sendMessage} disabled={busy || !inputMessage.trim()}>
              {busy ? "发送中..." : "探索"}
            </button>
          </div>
        </div>
      )}
      
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
            className="w-full p-3 border border-[#DCE9FF] rounded-xl text-sm mb-3 resize-none"
            rows={3}
          />
          <button
            onClick={handleSubmitComment}
            disabled={submittingComment || !newComment.trim()}
            className="px-4 py-2 bg-[#5B9DFF] text-white rounded-xl text-sm font-medium hover:bg-[#4A8FEF] transition-colors disabled:opacity-50"
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
