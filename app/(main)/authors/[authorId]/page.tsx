"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AuthorData {
  author: any;
  stats: any;
  is_following: boolean;
  works: { stories: any[], characters: any[], worlds: any[] };
}

export default function AuthorPage({ params }: { params: { authorId: string } }) {
  const [data, setData] = useState<AuthorData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
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
        setData(prev => prev ? { ...prev, is_following: result.following } : null);
      }
    } catch (error) {
      console.error("Failed to toggle follow:", error);
    }
  };
  
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-24 bg-gray-200 rounded mb-6"></div>
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="p-6">
        <p className="text-gray-600">作者不存在</p>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 作者信息 */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
          {data.author.username?.charAt(0)?.toUpperCase() || "A"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-2xl font-bold text-gray-800">{data.author.username}</h1>
            <button
              onClick={toggleFollow}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                data.is_following 
                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300" 
                  : "bg-indigo-500 text-white hover:bg-indigo-600"
              }`}
            >
              {data.is_following ? "已关注" : "关注"}
            </button>
          </div>
          <p className="text-gray-600 mb-4">{data.author.bio || "这个作者很懒，什么都没写~"}</p>
          
          {/* 统计数据 */}
          <div className="flex gap-8 text-sm">
            <div>
              <span className="font-semibold text-gray-800">{data.stats.stories.count}</span>
              <span className="text-gray-500 ml-1">故事</span>
            </div>
            <div>
              <span className="font-semibold text-gray-800">{data.stats.characters.count}</span>
              <span className="text-gray-500 ml-1">角色</span>
            </div>
            <div>
              <span className="font-semibold text-gray-800">{data.stats.worlds.count}</span>
              <span className="text-gray-500 ml-1">世界</span>
            </div>
            <div>
              <span className="font-semibold text-gray-800">{data.stats.followers}</span>
              <span className="text-gray-500 ml-1">粉丝</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 作品列表 */}
      {data.works.stories.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">故事</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.works.stories.map(story => (
              <Link key={story.id} href={`/stories/${story.id}`} className="block">
                <div className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="h-24 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg mb-3"></div>
                  <h3 className="font-medium text-gray-800 truncate">{story.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{story.summary}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
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
          <h2 className="text-xl font-semibold text-gray-800 mb-4">角色</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.works.characters.map(character => (
              <Link key={character.id} href={`/characters/${character.id}`} className="block">
                <div className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="h-24 bg-gradient-to-br from-pink-400 to-red-500 rounded-lg mb-3"></div>
                  <h3 className="font-medium text-gray-800 truncate">{character.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{character.summary}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
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
          <h2 className="text-xl font-semibold text-gray-800 mb-4">世界</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.works.worlds.map(world => (
              <Link key={world.id} href={`/worlds/${world.id}`} className="block">
                <div className="border rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="h-24 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg mb-3"></div>
                  <h3 className="font-medium text-gray-800 truncate">{world.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{world.summary}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
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
        <div className="text-center py-12">
          <p className="text-gray-500">这个作者还没有发布任何作品~</p>
        </div>
      )}
    </div>
  );
}
