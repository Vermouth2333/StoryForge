"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { App } from "antd";
import AuthorWorkEditor from "@/components/AuthorWorkEditor";
import CoverDisplay from "@/components/CoverDisplay";
import TargetReviewSection from "@/components/TargetReviewSection";
import { useWorkPageMode } from "@/hooks/use-work-page-mode";
import { useWorkConfirm } from "@/hooks/use-work-confirm";
import { resolveCharacterEditorValues } from "@/lib/work-draft";

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
  cover_asset_id?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
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
  draft_json?: string | null;
  has_unsynced_draft?: boolean;
};

export default function CharacterDetailPage() {
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const { canEdit } = useWorkPageMode(row?.author_id, currentUserId || null);
  const { confirmDelete } = useWorkConfirm();

  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;

      const [characterRes, profileRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch(`/api/profile`),
      ]);
      
      const characterJson = await characterRes.json();
      if (characterJson.code === 200) {
        setRow(characterJson.data);
      } else {
        setError(characterJson.msg ?? "加载失败");
      }

      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        if (profileJson.code === 200 && profileJson.data?.id) {
          setCurrentUserId(profileJson.data.id);
        }
      }

      setLoading(false);
    })();
  }, [params.id]);

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

  function handleDelete() {
    if (!row || row.status === "published") return;
    confirmDelete("character", row.name, async () => {
      const res = await fetch(`/api/characters/${row.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.code === 200) {
        message.success("已删除");
        router.push("/my");
      } else {
        message.error(json.msg ?? "删除失败");
      }
    });
  }

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
      {/* 对话入口 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-1">
              <span>💬</span> 与 {row.name} 对话
            </h3>
            <p className="text-xs text-[#5B6B8C]">在新页面中开启对话并查看历史会话</p>
          </div>
          <Link href={`/characters/${row.id}/chat`} className="sf-btn-primary">
            进入对话 →
          </Link>
        </div>
      </div>

      {canEdit && row && (() => {
        const editorValues = resolveCharacterEditorValues(row);
        return (
          <AuthorWorkEditor
            kind="character"
            id={row.id}
            status={row.status}
            hasUnsyncedDraft={Boolean(row.has_unsynced_draft)}
            name={editorValues.name}
            summary={editorValues.summary}
            tagsJson={editorValues.tagsJson}
            personality={editorValues.personality}
            coverUrl={row.cover_url}
            coverThumbnailUrl={row.cover_thumbnail_url}
            onCoverUploaded={(url) => setRow((prev) => (prev ? { ...prev, cover_url: url } : prev))}
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
            onDelete={handleDelete}
          />
        );
      })()}

      {/* 角色信息卡片 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {!canEdit && (
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
          )}
          <div className={`flex flex-wrap gap-2${canEdit ? " w-full justify-end" : ""}`}>
            {!canEdit && (
              <Link href="/market" className="sf-tag">
                返回市场
              </Link>
            )}
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
            {row.author_id && row.author_id !== currentUserId && (
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
        {!canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="sf-tag">{tag}</span>
            ))}
          </div>
        )}
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
            <p className="text-xs text-[#5B6B8C]">作者</p>
          </Link>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
            <span>🖼️</span> 封面图
          </h3>
          {row.cover_url ? (
            <CoverDisplay src={row.cover_url} alt={`${row.name} 封面`} />
          ) : (
            <p className="text-sm text-[#5B6B8C]">暂无封面</p>
          )}
        </div>
      )}

      {!canEdit && row.personality && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2">
            <span>🎭</span> 性格与设定
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[#5B6B8C] leading-relaxed">
            {row.personality}
          </p>
        </div>
      )}

      <TargetReviewSection
        targetType="character"
        targetId={row.id}
        currentUserId={currentUserId || undefined}
      />
    </main>
  );
}
