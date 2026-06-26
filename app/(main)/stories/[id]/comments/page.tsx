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
}

async function fetchComments(storyId: string, page: number = 1) {
  const res = await fetch(`/api/stories/${storyId}/comments?page=${page}&page_size=20`);
  const data = await res.json();
  return data;
}

async function submitComment(storyId: string, content: string) {
  const res = await fetch(`/api/stories/${storyId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

async function toggleLike(commentId: string) {
  const res = await fetch(`/api/comments/${commentId}/like`, {
    method: "POST",
  });
  return res.json();
}

export default function StoryCommentsPage({ params }: { params: { id: string } }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const data = await fetchComments(params.id, page);
    if (data.code === 200) {
      setComments(data.data.comments);
      setTotalPages(data.data.pagination.totalPages);
    }
    setLoading(false);
  }, [params.id, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadComments();
  }, [loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const data = await submitComment(params.id, newComment);
    if (data.code === 200) {
      setNewComment("");
      setPage(1);
    }
  };

  const handleLike = async (commentId: string) => {
    const data = await toggleLike(commentId);
    if (data.code === 200) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                isLiked: !c.isLiked,
                likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1,
              }
            : c
        )
      );
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="sf-card">
        <div className="border-b border-[#DCE9FF] p-4">
          <h1 className="text-xl font-semibold text-[#1F2A44]">故事评论</h1>
          <p className="text-sm text-[#5B6B8C] mt-1">与其他读者分享你的想法</p>
        </div>

        <div className="p-4">
          <form onSubmit={handleSubmit} className="mb-6">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="写下你的评论..."
              className="sf-input resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="sf-btn-primary disabled:opacity-50"
              >
                发布评论
              </button>
            </div>
          </form>

          {loading ? (
            <div className="sf-loading-sm" />
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-[#5B6B8C]">暂无评论</div>          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl bg-[#F8FBFF] p-4 hover:bg-[#EEF6FF] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={comment.avatarUrl || "/api/placeholder/avatar"}
                      alt={comment.username}
                      className="w-10 h-10 rounded-full bg-[#DCE9FF]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1F2A44]">{comment.username}</span>
                        <span className="text-xs text-[#5B6B8C]">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[#1F2A44]">{comment.content}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <button
                          onClick={() => handleLike(comment.id)}
                          className={`flex items-center gap-1 text-xs ${
                            comment.isLiked ? "text-red-500" : "text-[#5B6B8C]"
                          } hover:text-red-500`}
                        >
                          <span>{comment.isLiked ? "❤️" : "🤍"}</span>
                          <span>{comment.likeCount}</span>
                        </button>
                        <button className="flex items-center gap-1 text-xs text-[#5B6B8C] hover:text-[#1F2A44]">
                          <span>💬</span>
                          <span>{comment.replyCount}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="sf-tag disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="text-sm text-[#5B6B8C]">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="sf-tag disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
