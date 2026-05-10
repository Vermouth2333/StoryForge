"use client";

import { useState, useEffect } from "react";

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

async function fetchComments(characterId: string, page: number = 1) {
  const res = await fetch(`/api/characters/${characterId}/comments?page=${page}&page_size=20`);
  const data = await res.json();
  return data;
}

async function submitComment(characterId: string, content: string) {
  const res = await fetch(`/api/characters/${characterId}/comments`, {
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

export default function CharacterCommentsPage({ params }: { params: { id: string } }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadComments();
  }, [params.id, page]);

  const loadComments = async () => {
    setLoading(true);
    const data = await fetchComments(params.id, page);
    if (data.code === 200) {
      setComments(data.data.comments);
      setTotalPages(data.data.pagination.totalPages);
    }
    setLoading(false);
  };

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
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold">角色评论</h1>
          <p className="text-gray-500 text-sm mt-1">分享你对这个角色的看法</p>
        </div>

        <div className="p-4">
          <form onSubmit={handleSubmit} className="mb-6">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="写下你的评论..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                发布评论
              </button>
            </div>
          </form>

          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无评论</div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={comment.avatarUrl || "/api/placeholder/avatar"}
                      alt={comment.username}
                      className="w-10 h-10 rounded-full bg-gray-200"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{comment.username}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-2 text-gray-700">{comment.content}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <button
                          onClick={() => handleLike(comment.id)}
                          className={`flex items-center gap-1 text-sm ${
                            comment.isLiked ? "text-red-500" : "text-gray-500"
                          }`}
                        >
                          <span>{comment.isLiked ? "❤️" : "🤍"}</span>
                          <span>{comment.likeCount}</span>
                        </button>
                        <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
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
  );
}
