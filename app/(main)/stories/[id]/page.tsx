"use client";

import { App } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthorWorkEditor from "@/components/AuthorWorkEditor";
import CoverDisplay from "@/components/CoverDisplay";
import MarketDownloadButton from "@/components/MarketDownloadButton";
import { BookOpen, Gamepad2, IconBadge } from "@/components/icons";
import TargetReviewSection from "@/components/TargetReviewSection";
import { useWorkPageMode } from "@/hooks/use-work-page-mode";
import { useWorkConfirm } from "@/hooks/use-work-confirm";
import { currentPathForLogin, loginHref } from "@/lib/login-redirect";
import { resolveStoryEditorValues } from "@/lib/work-draft";

type StoryDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  title: string;
  summary: string;
  greeting?: string;
  is_derivative?: boolean;
  source_work_id?: string | null;
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
  pending_review: "审核中",
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
  const { canEdit, isAuthor } = useWorkPageMode(story?.author_id, currentUserId || null);
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

  async function ensureLoggedIn(): Promise<boolean> {
    if (currentUserId) return true;
    const res = await fetch("/api/profile");
    if (res.ok) {
      const json = await res.json();
      if (json.code === 200 && json.data?.id) {
        setCurrentUserId(String(json.data.id));
        return true;
      }
    }
    router.push(loginHref(currentPathForLogin()));
    return false;
  }

  async function toggleLike() {
    if (!story) return;
    if (!(await ensureLoggedIn())) return;
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
    if (!(await ensureLoggedIn())) return;
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
    if (!(await ensureLoggedIn())) return;
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
      <main className="sf-page-enter mx-auto max-w-4xl p-6 text-sm text-[var(--text-secondary)]">
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

  const showDownload = Boolean(story && !isAuthor && story.status === "published");
  const showPlay = Boolean(story && isAuthor);

  return (
    <main className="sf-detail-page sf-page-enter mx-auto max-w-4xl p-6">
      {/* 操作入口：市场访客先下载；本地/作者侧再互动体验 */}
      <div
        className={`sf-detail-actions sf-stagger mb-6 grid grid-cols-1 gap-4${
          canEdit || (showDownload && showPlay) ? " sm:grid-cols-2" : ""
        }`}
      >
        {showDownload && (
          <div className="sf-action-card sf-lift flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
            <div className="text-left">
              <p className="font-medium text-[var(--foreground)]">下载到本地</p>
              <p className="text-xs text-[var(--text-secondary)]">下载后可在「我的」中体验与对话</p>
            </div>
            <MarketDownloadButton
              workType="story"
              workId={story.id}
              currentUserId={currentUserId || undefined}
            />
          </div>
        )}
        {canEdit && (
          <Link
            href={`/stories/${story.id}/edit`}
            className="sf-action-card sf-lift sf-focus-ring flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary-muted)] transition-all"
          >
            <IconBadge icon={BookOpen} tone="story" size="md" />
            <div className="text-left">
              <p className="font-medium text-[var(--foreground)]">章节大纲</p>
              <p className="text-xs text-[var(--text-secondary)]">编辑故事章节结构</p>
            </div>
          </Link>
        )}
        {showPlay && (
          <Link
            href={`/stories/${story.id}/play`}
            className="sf-action-card sf-action-card--primary sf-lift sf-focus-ring sf-hover-glow flex items-center justify-center gap-2 rounded-xl border border-[var(--primary-muted)] bg-gradient-to-r from-[var(--primary-soft)] to-[var(--character-bg)] p-4 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-hover)] transition-all"
          >
            <IconBadge icon={Gamepad2} tone="primary" size="md" />
            <div className="text-left">
              <p className="font-medium text-[var(--primary)]">互动体验</p>
              <p className="text-xs text-[var(--text-secondary)]">选择人设面具开始冒险</p>
            </div>
          </Link>
        )}
      </div>

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
            greeting={editorValues.greeting}
            isDerivative={Boolean(story.is_derivative)}
            sourceWorkId={story.source_work_id}
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
            onDelete={handleDelete}
          />
        );
      })()}

      {/* 故事信息卡片 */}
      <div className="sf-detail-card sf-reveal rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6 shadow-[var(--shadow-soft)]" style={{ animationDelay: "0.1s" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          {!canEdit && (
            <div className="flex-1">
              <h1 className="sf-detail-title text-2xl font-bold text-[var(--foreground)]">{story.title}</h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-md leading-relaxed">{story.summary || "暂无简介"}</p>
            </div>
          )}
          <div className={`sf-detail-actions-inline flex flex-wrap gap-2${canEdit ? " w-full justify-end" : ""}`}>
            {!canEdit && (
              <Link href="/market" className="sf-tag sf-focus-ring sf-press">
                返回市场
              </Link>
            )}
            <button
              type="button"
              className={`sf-tag sf-focus-ring sf-press transition-all ${story.liked_by_me ? "!bg-gradient-to-r !from-[var(--primary)] !to-[var(--character-color)] !text-white !border-transparent" : ""}`}
              onClick={() => void toggleLike()}
            >
              {story.liked_by_me ? "❤️ 已点赞" : "🤍 点赞"} ({story.like_count})
            </button>
            <button
              type="button"
              className={`sf-tag sf-focus-ring sf-press transition-all ${story.favorited_by_me ? "!bg-gradient-to-r !from-[var(--accent-warm)] !to-[var(--primary)] !text-white !border-transparent" : ""}`}
              onClick={() => void toggleFavorite()}
            >
              {story.favorited_by_me ? "★ 已收藏" : "☆ 收藏"} ({story.favorite_count})
            </button>
            {story.author_id && story.author_id !== currentUserId && (
              <button
                type="button"
                className={`sf-tag sf-focus-ring sf-press transition-all ${story.is_following ? "!bg-[var(--primary)] !text-white !border-transparent" : ""}`}
                onClick={() => void toggleFollow()}
              >
                {story.is_following ? "已关注作者" : "＋ 关注作者"}
              </button>
            )}
          </div>
        </div>
        {!canEdit && tags.length > 0 && (
          <div className="sf-detail-tags mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="sf-tag sf-tag--subtle">{tag}</span>
            ))}
          </div>
        )}
        <div className="sf-detail-stats mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 sf-stagger">
          <div className="sf-stat-card sf-lift rounded-xl bg-gradient-to-br from-[var(--primary-soft)] to-[var(--surface)] p-4 text-center border border-[var(--border)]">
            <p className="text-lg font-bold text-[var(--primary)]">{story.like_count}</p>
            <p className="text-xs text-[var(--text-secondary)]">点赞</p>
          </div>
          <div className="sf-stat-card sf-lift rounded-xl bg-gradient-to-br from-[var(--accent-warm-soft)] to-[var(--surface)] p-4 text-center border border-[var(--border)]">
            <p className="text-lg font-bold text-[var(--accent-warm)]">{story.favorite_count}</p>
            <p className="text-xs text-[var(--text-secondary)]">收藏</p>
          </div>
          <div className="sf-stat-card sf-lift rounded-xl bg-gradient-to-br from-[var(--story-bg)] to-[var(--surface)] p-4 text-center border border-[var(--border)]">
            <p className="text-lg font-bold text-[var(--story-color)]">{STATUS_LABELS[story.status] ?? story.status}</p>
            <p className="text-xs text-[var(--text-secondary)]">状态</p>
          </div>
          <Link href={`/authors/${story.author_id}`} className="sf-stat-card sf-lift sf-focus-ring rounded-xl bg-gradient-to-br from-[var(--character-bg)] to-[var(--surface)] p-4 text-center border border-[var(--border)] hover:shadow-[var(--shadow-hover)] transition-all">
            <p className="text-lg font-bold text-[var(--character-color)]">{story.author_display || "作者"}</p>
            <p className="text-xs text-[var(--text-secondary)]">创建者</p>
          </Link>
        </div>
      </div>

      {!canEdit && (
        <div className="sf-detail-card sf-reveal rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6 shadow-[var(--shadow-soft)]" style={{ animationDelay: "0.15s" }}>
          <h3 className="sf-detail-section-title text-base font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
            <span className="sf-section-icon">🖼️</span> 封面图
          </h3>
          {story.cover_url ? (
            <div className="sf-cover-frame sf-lift rounded-lg overflow-hidden">
              <CoverDisplay src={story.cover_url} alt={`${story.title} 封面`} />
            </div>
          ) : (
            <div className="sf-empty-cover rounded-lg bg-gradient-to-br from-[var(--paper)] to-[var(--primary-soft)] p-8 text-center border border-dashed border-[var(--border)]">
              <p className="text-sm text-[var(--text-muted)]">暂无封面</p>
            </div>
          )}
        </div>
      )}

      {/* 角色关系图谱 */}
      {relations.length > 0 && (
        <div className="sf-detail-card sf-reveal rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 mb-6 shadow-[var(--shadow-soft)]" style={{ animationDelay: "0.2s" }}>
          <h3 className="sf-detail-section-title text-base font-semibold text-[var(--foreground)] flex items-center gap-2 mb-4">
            <span className="sf-section-icon">🔗</span> 角色关系
          </h3>
          <div className="sf-relations-list space-y-3 sf-stagger">
            {relations.map((rel) => (
              <div
                key={rel.id}
                className="sf-relation-item sf-lift flex flex-wrap items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[var(--character-bg)] via-[var(--surface)] to-[var(--character-bg)] p-4 border border-[var(--border)]"
              >
                <span className="font-medium text-[var(--character-color)]">{rel.character_left_name}</span>
                <span className="text-lg">↔️</span>
                <span className="sf-tag !bg-[var(--character-bg)] !text-[var(--character-color)]">{rel.relation_type}</span>
                <span className="font-medium text-[var(--character-color)]">{rel.character_right_name}</span>
                {rel.description && (
                  <span className="w-full text-center text-sm text-[var(--text-secondary)] mt-2 pt-2 border-t border-dashed border-[var(--border)]">
                    {rel.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <TargetReviewSection
        targetType="story"
        targetId={story.id}
        currentUserId={currentUserId || undefined}
      />
    </main>
  );
}
