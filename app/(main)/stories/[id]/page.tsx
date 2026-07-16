"use client";

import { App } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthorWorkEditor from "@/components/AuthorWorkEditor";
import CoverDisplay from "@/components/CoverDisplay";
import TargetReviewSection from "@/components/TargetReviewSection";
import { useWorkPageMode } from "@/hooks/use-work-page-mode";
import { useWorkConfirm } from "@/hooks/use-work-confirm";
import { resolveStoryEditorValues } from "@/lib/work-draft";

type StoryDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  title: string;
  summary: string;
  status: string;
  tags_json: string;
  cover_asset_id?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
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

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
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

export default function StoryDetailPage() {
  const { message } = App.useApp();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [relations, setRelations] = useState<CharacterRelation[]>([]);
  const { canEdit } = useWorkPageMode(story?.author_id, currentUserId || null);
  const { confirmDelete } = useWorkConfirm();

  useEffect(() => {
    void (async () => {
      const storyId = params.id;
      if (!storyId) return;

      const [storyRes, relationsRes, profileRes] = await Promise.all([
        fetch(`/api/stories/${storyId}`),
        fetch(`/api/stories/${storyId}/relations`),
        fetch(`/api/profile`),
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
    if (!story) return;
    const prev = story;
    setStory({
      ...prev,
      liked_by_me: !prev.liked_by_me,
      like_count: prev.like_count + (prev.liked_by_me ? -1 : 1),
    });
    const res = await fetch("/api/likes/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "story", target_id: prev.id }),
    });
    const json = await res.json();
    if (json.code !== 200) {
      setStory(prev);
      message.error(json.msg ?? "操作失败");
    }
  }

  async function toggleFavorite() {
    if (!story) return;
    const prev = story;
    const nextFav = !prev.favorited_by_me;
    setStory({
      ...prev,
      favorited_by_me: nextFav,
      favorite_count: prev.favorite_count + (nextFav ? 1 : -1),
    });
    const res = await fetch("/api/favorites/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "story", target_id: prev.id }),
    });
    const json = await res.json();
    if (json.code === 200) {
      message.success(nextFav ? "已收藏" : "已取消收藏");
    } else {
      setStory(prev);
      message.error(json.msg ?? "操作失败");
    }
  }

  async function toggleFollow() {
    if (!story) return;
    const prev = story;
    const nextFollow = !prev.is_following;
    setStory({ ...prev, is_following: nextFollow });
    const res = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: prev.author_id }),
    });
    const json = await res.json();
    if (json.code === 200) {
      message.success(nextFollow ? "已关注" : "已取消关注");
    } else {
      setStory(prev);
      message.error(json.msg ?? "操作失败");
    }
  }

  function handleDelete() {
    if (!story || story.status === "published") return;
    confirmDelete("story", story.title, async () => {
      const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
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

  return (
    <main className="mx-auto max-w-4xl p-6">
      {canEdit && story && (() => {
        const editorValues = resolveStoryEditorValues(story);
        return (
          <AuthorWorkEditor
            kind="story"
            id={story.id}
            status={story.status}
            hasUnsyncedDraft={Boolean(story.has_unsynced_draft)}
            name={editorValues.name}
            summary={editorValues.summary}
            tagsJson={editorValues.tagsJson}
            coverUrl={story.cover_url}
            coverThumbnailUrl={story.cover_thumbnail_url}
            onCoverUploaded={(url) => setStory((prev) => (prev ? { ...prev, cover_url: url } : prev))}
            onUpdated={(patch) =>
              setStory((prev) =>
                prev
                  ? {
                      ...prev,
                      ...patch,
                      title: typeof patch.title === "string" ? patch.title : prev.title,
                    }
                  : prev,
              )
            }
            onStatusChange={(st, publishAt) =>
              setStory((prev) =>
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
        );
      })()}

      {/* 故事信息卡片 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {!canEdit && (
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#1F2A44]">{story.title}</h1>
              <p className="mt-2 text-sm text-[#5B6B8C] max-w-md">{story.summary || "暂无简介"}</p>
            </div>
          )}
          <div className={`flex flex-wrap gap-2${canEdit ? " w-full justify-end" : ""}`}>
            <Link href={canEdit ? "/my" : "/market"} className="sf-tag">
              {canEdit ? "返回我的" : "返回市场"}
            </Link>
            <Link href={`/stories/${story.id}/play`} className="sf-btn-primary">
              🎮 开始体验
            </Link>
            <button
              type="button"
              className={`sf-tag ${story.liked_by_me ? "!bg-[#5B9DFF] !text-white" : ""}`}
              onClick={() => void toggleLike()}
            >
              {story.liked_by_me ? "❤️ 已点赞" : "🤍 点赞"} ({story.like_count})
            </button>
            <button
              type="button"
              className={`sf-tag ${story.favorited_by_me ? "!bg-[#5B9DFF] !text-white" : ""}`}
              onClick={() => void toggleFavorite()}
            >
              {story.favorited_by_me ? "★ 已收藏" : "☆ 收藏"} ({story.favorite_count})
            </button>
            {story.author_id && story.author_id !== currentUserId && (
              <button
                type="button"
                className={`sf-tag ${story.is_following ? "!bg-[#5B9DFF] !text-white" : ""}`}
                onClick={() => void toggleFollow()}
              >
                {story.is_following ? "已关注作者" : "＋ 关注作者"}
              </button>
            )}
            {canEdit && story.status !== "published" && (
              <button type="button" className="sf-tag !text-[#8B2E2E]" onClick={() => void handleDelete()}>
                删除
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
            <p className="text-lg font-bold text-[#5B9DFF]">{story.like_count}</p>
            <p className="text-xs text-[#5B6B8C]">点赞</p>
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{story.favorite_count}</p>
            <p className="text-xs text-[#5B6B8C]">收藏</p>
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{STATUS_LABELS[story.status] ?? story.status}</p>
            <p className="text-xs text-[#5B6B8C]">状态</p>
          </div>
          <Link href={`/authors/${story.author_id}`} className="rounded-xl bg-[#F8FBFF] p-4 text-center hover:bg-[#EEF6FF] transition-colors">
            <p className="text-lg font-bold text-[#5B9DFF]">{story.author_display || "作者"}</p>
            <p className="text-xs text-[#5B6B8C]">创建者</p>
          </Link>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
            <span>🖼️</span> 封面图
          </h3>
          {story.cover_url ? (
            <CoverDisplay src={story.cover_url} alt={`${story.title} 封面`} />
          ) : (
            <p className="text-sm text-[#5B6B8C]">暂无封面</p>
          )}
        </div>
      )}

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
        <div className={`grid grid-cols-1 gap-4${canEdit ? " sm:grid-cols-2" : ""}`}>
          {canEdit && (
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
          )}
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

      <TargetReviewSection
        targetType="story"
        targetId={story.id}
        currentUserId={currentUserId || undefined}
      />
    </main>
  );
}
