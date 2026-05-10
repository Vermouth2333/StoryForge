"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type StoryDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  title: string;
  summary: string;
  status: string;
  tags_json: string;
  like_count: number;
  favorite_count: number;
  publish_at: string | null;
  updated_at: string;
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
  const params = useParams<{ id: string }>();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [relations, setRelations] = useState<CharacterRelation[]>([]);

  useEffect(() => {
    void (async () => {
      const storyId = params.id;
      if (!storyId) return;
      const [storyRes, relationsRes] = await Promise.all([
        fetch(`/api/stories/${storyId}`),
        fetch(`/api/stories/${storyId}/relations`),
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
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-[#5B6B8C]">加载中...</main>;
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
      {/* 故事信息卡片 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1F2A44]">{story.title}</h1>
            <p className="mt-2 text-sm text-[#5B6B8C] max-w-md">{story.summary || "暂无简介"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/market" className="sf-tag">
              返回市场
            </Link>
            <Link href={`/stories/${story.id}/play`} className="sf-btn-primary">
              🎮 开始体验
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="sf-tag">{tag}</span>
          ))}
        </div>
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
            <p className="text-lg font-bold text-[#5B9DFF]">{story.status}</p>
            <p className="text-xs text-[#5B6B8C]">状态</p>
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{story.author_display || "作者"}</p>
            <p className="text-xs text-[#5B6B8C]">创建者</p>
          </div>
        </div>
      </div>

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
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6">
        <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
          <span>📚</span> 更多操作
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </main>
  );
}
