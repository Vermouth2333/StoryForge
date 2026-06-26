"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface Comment {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  content: string;
  createdAt: string;
  likeCount: number;
  replyCount: number;
  isLiked: boolean;
  targetType: string;
  targetId: string;
  targetTitle: string;
}

interface Reply {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  content: string;
  createdAt: string;
  likeCount: number;
  isLiked: boolean;
}

async function fetchComment(commentId: string) {
  const res = await fetch(`/api/comments/${commentId}`);
  return res.json();
}

async function fetchReplies(commentId: string, page: number = 1) {
  const res = await fetch(`/api/comments/${commentId}/replies?page=${page}&page_size=20`);
  return res.json();
}

async function submitReply(commentId: string, content: string) {
  const res = await fetch(`/api/comments/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

async function toggleLike(targetId: string) {
  const res = await fetch(`/api/comments/${targetId}/like`, { method: "POST" });
  return res.json();
}

export default function CommentDetailPage() {
  const params = useParams<{ id: string }>();
  const [comment, setComment] = useState<Comment | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const loadComment = useCallback(async () => {
    setLoading(true);
    const data = await fetchComment(params.id);
    if (data.code === 200) setComment(data.data);
    setLoading(false);
  }, [params.id]);

  const loadReplies = useCallback(async () => {
    const data = await fetchReplies(params.id, page);
    if (data.code === 200) {
      setReplies(data.data.replies);
      setTotalPages(data.data.pagination.totalPages);
    }
  }, [params.id, page]);

  useEffect(() => { loadComment(); }, [loadComment]);
  useEffect(() => { if (comment) loadReplies(); }, [comment, loadReplies]);

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReply.trim()) return;
    const data = await submitReply(params.id, newReply);
    if (data.code === 200) { setNewReply(""); setPage(1); }
  };

  const handleLike = async (targetId: string, isComment: boolean) => {
    const data = await toggleLike(targetId);
    if (data.code === 200) {
      if (isComment && comment) {
        setComment({ ...comment, isLiked: !comment.isLiked, likeCount: comment.isLiked ? comment.likeCount - 1 : comment.likeCount + 1 });
      } else {
        setReplies((prev) => prev.map((r) => r.id === targetId ? { ...r, isLiked: !r.isLiked, likeCount: r.isLiked ? r.likeCount - 1 : r.likeCount + 1 } : r));
      }
    }
  };

  const getTargetUrl = () => {
    if (!comment) return "#";
    switch (comment.targetType) {
      case "story": return `/stories/${comment.targetId}`;
      case "character": return `/characters/${comment.targetId}`;
      case "world": return `/worlds/${comment.targetId}`;
      default: return "#";
    }
  };

  if (loading) {
    return <div className="sf-loading" />;
  }

  if (!comment) {
    return <div className="mx-auto max-w-2xl py-8"><div className="py-8 text-center text-[#5B6B8C]">评论不存在</div></div>;
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="sf-card">
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={comment.avatarUrl || "/api/placeholder/avatar"} alt={comment.username}
              className="h-12 w-12 shrink-0 rounded-full bg-[#DCE9FF]" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#1F2A44]">{comment.username}</span>
                <span className="text-sm text-[#5B6B8C]">{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-3 leading-relaxed text-[#1F2A44]">{comment.content}</p>
              <div className="mt-4 flex items-center gap-4">
                <button onClick={() => handleLike(comment.id, true)}
                  className={`flex items-center gap-1 text-xs ${comment.isLiked ? "text-red-500" : "text-[#5B6B8C]"} hover:text-red-500`}>
                  <span>{comment.isLiked ? "❤️" : "🤍"}</span><span>{comment.likeCount}</span>
                </button>
                <button className="flex items-center gap-1 text-xs text-[#5B6B8C] hover:text-[#1F2A44]">
                  <span>💬</span><span>{comment.replyCount} 回复</span>
                </button>
              </div>
              <div className="mt-3 border-t border-[#DCE9FF] pt-3">
                <a href={getTargetUrl()} className="text-sm text-[#5B9DFF] hover:text-[#4A8FEF]">
                  查看原内容: {comment.targetTitle}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#DCE9FF]">
          <div className="p-4">
            <form onSubmit={handleSubmitReply} className="mb-6">
              <textarea value={newReply} onChange={(e) => setNewReply(e.target.value)}
                placeholder="写下你的回复..." className="sf-input resize-none" rows={2} />
              <div className="mt-2 flex justify-end">
                <button type="submit" disabled={!newReply.trim()} className="sf-btn-primary disabled:opacity-50">回复</button>
              </div>
            </form>

            {replies.length === 0 ? (
              <div className="py-8 text-center text-[#5B6B8C]">暂无回复</div>
            ) : (
              <div className="space-y-4">
                {replies.map((reply) => (
                  <div key={reply.id} className="rounded-xl bg-[#F8FBFF] p-4 hover:bg-[#EEF6FF] transition-colors">
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reply.avatarUrl || "/api/placeholder/avatar"} alt={reply.username}
                        className="h-8 w-8 shrink-0 rounded-full bg-[#DCE9FF]" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#1F2A44]">{reply.username}</span>
                          <span className="text-xs text-[#5B6B8C]">{new Date(reply.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-1 text-sm text-[#1F2A44]">{reply.content}</p>
                        <div className="mt-2 flex items-center gap-4">
                          <button onClick={() => handleLike(reply.id, false)}
                            className={`flex items-center gap-1 text-xs ${reply.isLiked ? "text-red-500" : "text-[#5B6B8C]"} hover:text-red-500`}>
                            <span>{reply.isLiked ? "❤️" : "🤍"}</span><span>{reply.likeCount}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <div className="flex items-center gap-3">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="sf-tag disabled:opacity-50">上一页</button>
                  <span className="text-sm text-[#5B6B8C]">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="sf-tag disabled:opacity-50">下一页</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
