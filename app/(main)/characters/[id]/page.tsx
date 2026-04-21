"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type CharacterDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  name: string;
  avatar_url: string | null;
  summary: string;
  personality: string;
  tags_json: string;
  status: string;
  like_count: number;
  publish_at: string | null;
  updated_at: string;
};

export default function CharacterDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;
      const res = await fetch(`/api/characters/${id}`);
      const json = await res.json();
      if (json.code === 200) {
        setRow(json.data);
      } else {
        setError(json.msg ?? "加载失败");
      }
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) {
    return <main className="mx-auto max-w-4xl p-6 text-sm text-[#5B6B8C]">加载中...</main>;
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
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            {row.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.avatar_url}
                alt=""
                className="h-20 w-20 shrink-0 rounded-xl border border-[#DCE9FF] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#EEF6FF] text-sm text-[#5B6B8C]">
                无头像
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-[#1F2A44]">{row.name}</h1>
              <p className="mt-2 text-sm text-[#5B6B8C]">{row.summary || "暂无简介"}</p>
            </div>
          </div>
          <Link href="/" className="sf-tag shrink-0">
            返回首页
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="sf-tag">
              {tag}
            </span>
          ))}
        </div>
        {row.personality ? (
          <div className="mt-5 rounded-xl border border-[#DCE9FF] bg-[#F8FBFF] p-4">
            <p className="text-sm font-medium text-[#1F2A44]">性格与设定</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#5B6B8C]">{row.personality}</p>
          </div>
        ) : null}
        <div className="mt-4 text-xs text-[#5B6B8C]">
          <p>作者：{row.author_display ?? row.author_id}</p>
          <p>状态：{row.status}</p>
          <p>点赞：{row.like_count}</p>
          <p>最后更新：{row.updated_at}</p>
        </div>
      </div>
    </main>
  );
}
