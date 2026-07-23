"use client";

import { App } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBadge, Star } from "@/components/icons";
import { useParams, useRouter } from "next/navigation";
import { currentPathForLogin, loginHref } from "@/lib/login-redirect";

interface WorkItem {
  id: string;
  title?: string;
  name?: string;
  summary?: string;
  like_count?: number;
  favorite_count?: number;
}

interface AuthorData {
  author: { id?: string; username?: string; bio?: string };
  stats: {
    stories: { count: number };
    characters: { count: number };
    worlds: { count: number };
    followers: number;
  };
  is_following: boolean;
  works: { stories: WorkItem[]; characters: WorkItem[]; worlds: WorkItem[] };
}

export default function AuthorPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const params = useParams<{ authorId: string }>();
  const authorId = params.authorId;
  const [data, setData] = useState<AuthorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [authorRes, profileRes] = await Promise.all([
          fetch(`/api/authors/${authorId}`),
          fetch("/api/profile"),
        ]);
        if (authorRes.ok) {
          setData(await authorRes.json());
        }
        if (profileRes.ok) {
          const profileJson = await profileRes.json();
          if (profileJson.code === 200 && profileJson.data?.id) {
            setMeId(String(profileJson.data.id));
          }
        }
      } catch (error) {
        console.error("Failed to fetch author data:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [authorId]);

  const isSelf = !!meId && (meId === authorId || meId === data?.author?.id);

  async function toggleFollow() {
    let uid = meId;
    if (!uid) {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const json = await res.json();
        if (json.code === 200 && json.data?.id) {
          uid = String(json.data.id);
          setMeId(uid);
        } else {
          router.push(loginHref(currentPathForLogin()));
          return;
        }
      } else {
        router.push(loginHref(currentPathForLogin()));
        return;
      }
    }
    if (uid === authorId || uid === data?.author?.id) {
      message.warning("不能关注自己");
      return;
    }
    const res = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: authorId }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setData((prev) =>
        prev ? { ...prev, is_following: Boolean(json.data?.followed) } : null,
      );
      message.success(json.msg ?? "操作成功");
    } else {
      message.error(json.msg ?? "操作失败");
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-6 h-24 rounded-xl bg-[#DCE9FF]"></div>
          <div className="mb-4 h-8 w-1/3 rounded bg-[#DCE9FF]"></div>
          <div className="mb-8 h-4 w-1/2 rounded bg-[#DCE9FF]"></div>
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
      <div className="mb-8 flex items-start gap-6">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5B9DFF] to-[#7FB4FF] text-3xl font-bold text-white">
          {data.author.username?.charAt(0)?.toUpperCase() || "A"}
        </div>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-4">
            <h1 className="text-2xl font-bold text-[#1F2A44]">{data.author.username}</h1>
            {!isSelf && (
              <button
                type="button"
                onClick={() => void toggleFollow()}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                  data.is_following ? "sf-btn-secondary" : "sf-btn-primary"
                }`}
              >
                {data.is_following ? "已关注" : "关注"}
              </button>
            )}
          </div>
          <p className="mb-4 text-[#5B6B8C]">{data.author.bio || "这个作者很懒，什么都没写~"}</p>

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

      {data.works.stories.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-[#1F2A44]">故事</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.works.stories.map((story) => (
              <Link key={story.id} href={`/stories/${story.id}`} className="block">
                <div className="sf-card p-4 hover:shadow-md transition-shadow">
                  <h3 className="truncate font-medium text-[#1F2A44]">{story.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[#5B6B8C]">{story.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#5B6B8C]">
                    <span>❤️ {story.like_count}</span>
                    <span className="inline-flex items-center gap-1">
                      <IconBadge icon={Star} tone="star" size="sm" /> {story.favorite_count}
                    </span>
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
                  <h3 className="truncate font-medium text-[#1F2A44]">{character.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[#5B6B8C]">{character.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#5B6B8C]">
                    <span>❤️ {character.like_count}</span>
                    <span className="inline-flex items-center gap-1">
                      <IconBadge icon={Star} tone="star" size="sm" /> {character.favorite_count}
                    </span>
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
                  <h3 className="truncate font-medium text-[#1F2A44]">{world.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[#5B6B8C]">{world.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#5B6B8C]">
                    <span>❤️ {world.like_count}</span>
                    <span className="inline-flex items-center gap-1">
                      <IconBadge icon={Star} tone="star" size="sm" /> {world.favorite_count}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.works.stories.length === 0 &&
        data.works.characters.length === 0 &&
        data.works.worlds.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[#5B6B8C]">这个作者还没有发布任何作品~</p>
          </div>
        )}
    </div>
  );
}
