"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type WorldDetail = {
  id: string;
  author_id: string;
  author_display?: string;
  name: string;
  cover_asset_id: string | null;
  summary: string;
  setting_notes: string;
  tags_json: string;
  status: string;
  like_count: number;
  publish_at: string | null;
  updated_at: string;
};

type KnowledgeEntry = {
  id: string;
  world_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export default function WorldDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<WorldDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    void (async () => {
      const id = params.id;
      if (!id) return;
      const [worldRes, profileRes] = await Promise.all([
        fetch(`/api/worlds/${id}`),
        fetch("/api/profile"),
      ]);
      const worldJson = await worldRes.json();
      const profileJson = await profileRes.json();
      if (profileJson.code === 200 && profileJson.data?.id) {
        setMeId(String(profileJson.data.id));
      }
      if (worldJson.code === 200) {
        setRow(worldJson.data);
        const kr = await fetch(`/api/worlds/${id}/knowledge`);
        const kj = await kr.json();
        if (kj.code === 200) {
          setKnowledge(kj.data ?? []);
        } else {
          setKnowledge([]);
        }
      } else {
        setError(worldJson.msg ?? "加载失败");
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
        {error || "世界不存在"}
      </main>
    );
  }

  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags_json) as string[];
  } catch {
    tags = [];
  }

  const isAuthor = meId !== null && meId === row.author_id;
  const world = row;

  async function reloadKnowledge() {
    const kr = await fetch(`/api/worlds/${world.id}/knowledge`);
    const kj = await kr.json();
    if (kj.code === 200) setKnowledge(kj.data ?? []);
  }

  async function addKnowledge() {
    const t = newTitle.trim();
    if (!t) return;
    const res = await fetch(`/api/worlds/${world.id}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, body: newBody }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setNewTitle("");
      setNewBody("");
      await reloadKnowledge();
    }
  }

  async function deleteEntry(entryId: string) {
    if (!window.confirm("确定删除该词条？")) return;
    const res = await fetch(`/api/worlds/${world.id}/knowledge/${entryId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (json.code === 200) await reloadKnowledge();
  }

  async function saveEdit(entryId: string) {
    if (!editTitle.trim()) return;
    const res = await fetch(`/api/worlds/${world.id}/knowledge/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), body: editBody }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setEditingId(null);
      await reloadKnowledge();
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#1F2A44]">{row.name}</h1>
          <Link href="/" className="sf-tag">
            返回首页
          </Link>
        </div>
        <p className="mt-3 text-sm text-[#5B6B8C]">{row.summary || "暂无简介"}</p>
        <p className="mt-2 text-xs text-[#5B6B8C]">
          作者：{row.author_display ?? row.author_id}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="sf-tag">
              {tag}
            </span>
          ))}
        </div>
        {row.setting_notes ? (
          <div className="mt-5 rounded-xl border border-[#DCE9FF] bg-[#F8FBFF] p-4">
            <p className="text-sm font-medium text-[#1F2A44]">世界设定</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#5B6B8C]">{row.setting_notes}</p>
          </div>
        ) : null}

        <div className="mt-6 rounded-xl border border-[#DCE9FF] bg-white p-4">
          <p className="text-sm font-medium text-[#1F2A44]">知识库</p>
          <p className="mt-1 text-xs text-[#5B6B8C]">
            词条用于补充规则、地理、势力等设定；已发布世界对访客可见。
          </p>
          <ul className="mt-3 space-y-3">
            {knowledge.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-[#DCE9FF] bg-[#F8FBFF] p-3 text-sm"
              >
                {editingId === e.id ? (
                  <div className="space-y-2">
                    <input
                      className="sf-input w-full text-sm"
                      value={editTitle}
                      onChange={(ev) => setEditTitle(ev.target.value)}
                    />
                    <textarea
                      className="sf-input min-h-[100px] w-full resize-y text-sm"
                      value={editBody}
                      onChange={(ev) => setEditBody(ev.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="sf-tag"
                        onClick={() => void saveEdit(e.id)}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="sf-tag"
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-[#1F2A44]">{e.title}</p>
                      {isAuthor ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="sf-tag text-xs"
                            onClick={() => {
                              setEditingId(e.id);
                              setEditTitle(e.title);
                              setEditBody(e.body);
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="sf-tag text-xs"
                            onClick={() => void deleteEntry(e.id)}
                          >
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {e.body ? (
                      <p className="mt-2 whitespace-pre-wrap text-[#5B6B8C]">{e.body}</p>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
          {knowledge.length === 0 ? (
            <p className="mt-2 text-xs text-[#5B6B8C]">暂无词条</p>
          ) : null}
          {isAuthor ? (
            <div className="mt-4 border-t border-[#DCE9FF] pt-4">
              <p className="text-xs font-medium text-[#1F2A44]">新增词条</p>
              <input
                className="sf-input mt-2 w-full text-sm"
                placeholder="标题"
                value={newTitle}
                onChange={(ev) => setNewTitle(ev.target.value)}
              />
              <textarea
                className="sf-input mt-2 min-h-[80px] w-full resize-y text-sm"
                placeholder="正文（可选）"
                value={newBody}
                onChange={(ev) => setNewBody(ev.target.value)}
              />
              <button
                type="button"
                className="sf-tag mt-2"
                onClick={() => void addKnowledge()}
              >
                添加
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 text-xs text-[#5B6B8C]">
          <p>状态：{row.status}</p>
          <p>点赞：{row.like_count}</p>
          <p>封面资源 ID：{row.cover_asset_id ?? "—"}</p>
          <p>最后更新：{row.updated_at}</p>
        </div>
      </div>
    </main>
  );
}
