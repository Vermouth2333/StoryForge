"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WorkItem {
  id: string;
  title?: string;
  name?: string;
  summary?: string;
  like_count?: number;
  favorite_count?: number;
}

interface AuthorData {
  author: { username?: string; bio?: string };
  stats: {
    stories: { count: number };
    characters: { count: number };
    worlds: { count: number };
    followers: number;
  };
  is_following: boolean;
  works: { stories: WorkItem[]; characters: WorkItem[]; worlds: WorkItem[] };
}

export default function AuthorPage({ params }: { params: { authorId: string } }) {
  const [data, setData] = useState<AuthorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/authors/${params.authorId}`);
        if (res.ok) {
          const data = await res.json();
          setData(data);
        }
      } catch (error) {
        console.error("Failed to fetch author data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.authorId]);

  const toggleFollow = async () => {
    try {
      const res = await fetch(`/api/follows/${params.authorId}`, { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        setData((prev) => (prev ? { ...prev, is_following: result.following } : null));
      }
    } catch (error) {
      console.error("Failed to toggle follow:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-6 h-24 rounded-xl bg-[#DCE9FF]"></div>
          <div className="mb-4 h-8 w-1/3 rounded bg-[#DCE9FF]"></div>
          <div className="mb-8 h-4 w-1/2 rounded bg-[#DCE9FF]"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-[#DCE9FF]"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-[#5B6B8C]">作者不存在</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* 作者信息 */}
      <div className="mb-8 flex items-start gap-6">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5B9DFF] to-[#A78BFA] text-3xl font-bold text-white">
          {data.author.username?.charAt(0)?.toUpperCase() || "A"}
        </div>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-4">
            <h1 className="text-2xl font-bold text-[#1F2A44]">{data.author.username}</h1>
            <button
              onClick={toggleFollow}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                data.is_following
                  ? "sf-btn-secondary"
                  : "sf-btn-primary"
              }`}
            >
              {data.is_following ? "已关注" : "关注"}
            </button>
          </div>
          <p className="mb-4 text-[#5B6B8C]">{data.author.bio || "这个作者很懒，什么都没写~"}</p>

          {/* 统计数据 */}
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="font-semibold text-[#1F2A44]">{data.stats.stories.count}</span>
              <span className="ml-1 text-[#5B6B8C]">故事</span>
            </div>
            <div>
              <span className="font-semibold text-[#1F2A44]">{data.stats.characters.count}</span>
              <span className="ml-1 text-[#5B6B8C]">角色</span>
            </div>
            <div>
              <span className="font-semibold text-[#1F2A44]">{data.stats.worlds.count}</span>
              <span className="ml-1 text-[#5B6B8C]">世界</span>
            </div>
            <div>
              <span className="font-semibold text-[#1F2A44]">{data.stats.followers}</span>
              <span className="ml-1 text-[#5B6B8C]">粉丝</span>
            </div>
          </div>
        </div>
      </div>

      {/* 作品列表 */}
      {data.works.stories.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-[#1F2A44]">故事</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.works.stories.map((story) => (
              <Link key={story.id} href={`/stories/${story.id}`} className="block">
                <div className="sf-card p-4 hover:shadow-md transition-shadow">
                  <div className="mb-3 h-24 rounded-lg bg-gradient-to-br from-[#5B9DFF] to-[#A78BFA]"></div>
                  <h3 className="truncate font-medium text-[#1F2A44]">{story.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[#5B6B8C]">{story.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#5B6B8C]">
                    <span>❤️ {story.like_count}</span>
                    <span>⭐ {story.favorite_count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.works.characters.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-[#1F2A44]">角色</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.works.characters.map((character) => (
              <Link key={character.id} href={`/characters/${character.id}`} className="block">
                <div className="sf-card p-4 hover:shadow-md transition-shadow">
                  <div className="mb-3 h-24 rounded-lg bg-gradient-to-br from-[#F472B6] to-[#EF4444]"></div>
                  <h3 className="truncate font-medium text-[#1F2A44]">{character.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[#5B6B8C]">{character.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#5B6B8C]">
                    <span>❤️ {character.like_count}</span>
                    <span>⭐ {character.favorite_count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.works.worlds.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-[#1F2A44]">世界</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.works.worlds.map((world) => (
              <Link key={world.id} href={`/worlds/${world.id}`} className="block">
                <div className="sf-card p-4 hover:shadow-md transition-shadow">
                  <div className="mb-3 h-24 rounded-lg bg-gradient-to-br from-[#2DD4BF] to-[#06B6D4]"></div>
                  <h3 className="truncate font-medium text-[#1F2A44]">{world.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[#5B6B8C]">{world.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#5B6B8C]">
                    <span>❤️ {world.like_count}</span>
                    <span>⭐ {world.favorite_count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.works.stories.length === 0 && data.works.characters.length === 0 && data.works.worlds.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-[#5B6B8C]">这个作者还没有发布任何作品~</p>
        </div>
      )}
    </div>
  );
}
