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
  publish_at: string | null;
  updated_at: string;
};

export default function StoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const storyId = params.id;
      if (!storyId) return;
      const res = await fetch(`/api/stories/${storyId}`);
      const json = await res.json();
      if (json.code === 200) {
        setStory(json.data);
      } else {
        setError(json.msg ?? "加载失败");
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
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1F2A44]">{story.title}</h1>
          <Link href="/" className="sf-tag">
            返回首页
          </Link>
        </div>
        <p className="mt-3 text-sm text-[#5B6B8C]">{story.summary || "暂无简介"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="sf-tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-4 text-xs text-[#5B6B8C]">
          <p>作者：{story.author_display ?? story.author_id}</p>
          <p>状态：{story.status}</p>
          <p>点赞：{story.like_count}</p>
          <p>最后更新：{story.updated_at}</p>
        </div>
      </div>
    </main>
  );
}
