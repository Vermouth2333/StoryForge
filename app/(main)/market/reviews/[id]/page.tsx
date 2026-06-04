"use client";

import { useState, useEffect, useCallback } from "react";

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
  const data = await res.json();
  return data;
}

async function fetchReplies(commentId: string, page: number = 1) {
  const res = await fetch(`/api/comments/${commentId}/replies?page=${page}&page_size=20`);
  const data = await res.json();
  return data;
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
  const res = await fetch(`/api/comments/${targetId}/like`, {
    method: "POST",
  });
  return res.json();
}

export default function CommentDetailPage({ params }: { params: { id: string } }) {
  const [comment, setComment] = useState<Comment | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const loadComment = useCallback(async () => {
    setLoading(true);
    const data = await fetchComment(params.id);
    if (data.code === 200) {
      setComment(data.data);
    }
    setLoading(false);
  }, [params.id]);

  const loadReplies = useCallback(async () => {
    const data = await fetchReplies(params.id, page);
    if (data.code === 200) {
      setReplies(data.data.replies);
      setTotalPages(data.data.pagination.totalPages);
    }
  }, [params.id, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadComment();
  }, [loadComment]);

  useEffect(() => {
    if (comment) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadReplies();
    }
  }, [comment, loadReplies]);

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReply.trim()) return;

    const data = await submitReply(params.id, newReply);
    if (data.code === 200) {
      setNewReply("");
      setPage(1);
    }
  };

  const handleLike = async (targetId: string, isComment: boolean) => {
    const data = await toggleLike(targetId);
    if (data.code === 200) {
      if (isComment && comment) {
        setComment({
          ...comment,
          isLiked: !comment.isLiked,
          likeCount: comment.isLiked ? comment.likeCount - 1 : comment.likeCount + 1,
        });
      } else {
        setReplies((prev) =>
          prev.map((r) =>
            r.id === targetId
              ? {
                  ...r,
                  isLiked: !r.isLiked,
                  likeCount: r.isLiked ? r.likeCount - 1 : r.likeCount + 1,
                }
              : r
          )
        );
      }
    }
  };

  const getTargetUrl = () => {
    if (!comment) return "#";
    switch (comment.targetType) {
      case "story":
        return `/stories/${comment.targetId}`;
      case "character":
        return `/characters/${comment.targetId}`;
      case "world":
        return `/worlds/${comment.targetId}`;
      default:
        return "#";
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="text-center py-8 text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!comment) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="text-center py-8 text-gray-500">评论不存在</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <img
              src={comment.avatarUrl || "/api/placeholder/avatar"}
              alt={comment.username}
              className="w-12 h-12 rounded-full bg-gray-200"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{comment.username}</span>
                <span className="text-sm text-gray-500">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-3 text-gray-700 leading-relaxed">{comment.content}</p>
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={() => handleLike(comment.id, true)}
                  className={`flex items-center gap-1 ${
                    comment.isLiked ? "text-red-500" : "text-gray-500"
                  }`}
                >
                  <span>{comment.isLiked ? "❤️" : "🤍"}</span>
                  <span>{comment.likeCount}</span>
                </button>
                <button className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
                  <span>💬</span>
                  <span>{comment.replyCount} 回复</span>
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <a
                  href={getTargetUrl()}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  查看原内容: {comment.targetTitle}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200">
          <div className="p-4">
            <form onSubmit={handleSubmitReply} className="mb-6">
              <textarea
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                placeholder="写下你的回复..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={!newReply.trim()}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  回复
                </button>
              </div>
            </form>

            {replies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无回复</div>
            ) : (
              <div className="space-y-4">
                {replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={reply.avatarUrl || "/api/placeholder/avatar"}
                        alt={reply.username}
                        className="w-8 h-8 rounded-full bg-gray-200"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{reply.username}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(reply.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-1 text-gray-700 text-sm">{reply.content}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button
                            onClick={() => handleLike(reply.id, false)}
                            className={`flex items-center gap-1 text-xs ${
                              reply.isLiked ? "text-red-500" : "text-gray-500"
                            }`}
                          >
                            <span>{reply.isLiked ? "❤️" : "🤍"}</span>
                            <span>{reply.likeCount}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="px-4 py-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
