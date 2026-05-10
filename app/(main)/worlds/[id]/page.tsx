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
  favorite_count: number;
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

type MessageItem = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
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
  
  // 对话状态
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");

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

  async function createSession() {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "world",
        world_id: params.id,
        title: `探索${row?.name}`,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setSessionId(json.data.session_id);
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || !sessionId) return;
    setBusy(true);
    setStreamText("");
    
    const userMsg: MessageItem = {
      id: "temp",
      role: "user",
      content: inputMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: inputMessage }),
      });
      if (!res.body) {
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as any;
          if (payload.type === "content") {
            setStreamText((t) => t + payload.content);
          }
        }
      }
      if (streamText) {
        const assistantMsg: MessageItem = {
          id: "assistant_" + Date.now(),
          role: "assistant",
          content: streamText,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => {
          const newList = [...prev];
          return [...newList.slice(0, -1), assistantMsg];
        });
      }
      setStreamText("");
    } finally {
      setBusy(false);
    }
  }

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
      {/* 世界信息卡片 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1F2A44]">{row.name}</h1>
            <p className="mt-2 text-sm text-[#5B6B8C] max-w-md">{row.summary || "暂无简介"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/market" className="sf-tag">
              返回市场
            </Link>
            {!sessionId ? (
              <button className="sf-btn-primary" onClick={createSession}>
                🌍 探索世界
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="sf-tag">{tag}</span>
          ))}
        </div>
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
            <p className="text-lg font-bold text-[#5B9DFF]">{row.status}</p>
            <p className="text-xs text-[#5B6B8C]">状态</p>
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-4 text-center">
            <p className="text-lg font-bold text-[#5B9DFF]">{row.author_display || "作者"}</p>
            <p className="text-xs text-[#5B6B8C]">创建者</p>
          </div>
        </div>
      </div>

      {/* 世界设定 */}
      {row.setting_notes && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2">
            <span>📖</span> 世界设定
          </h3>
          <p className="mt-3 whitespace-pre-wrap text-sm text-[#5B6B8C] leading-relaxed">
            {row.setting_notes}
          </p>
        </div>
      )}

      {/* 知识库 */}
      <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
        <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2">
          <span>📚</span> 知识库
        </h3>
        <p className="mt-1 text-xs text-[#5B6B8C]">
          词条用于补充规则、地理、势力等设定；已发布世界对访客可见。
        </p>
        {knowledge.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {knowledge.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-[#DCE9FF] bg-[#F8FBFF] p-4"
              >
                {editingId === e.id ? (
                  <div className="space-y-2">
                    <input
                      className="sf-input w-full text-sm"
                      value={editTitle}
                      onChange={(ev) => setEditTitle(ev.target.value)}
                    />
                    <textarea
                      className="sf-input min-h-[80px] w-full resize-y text-sm"
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
                      <h4 className="font-medium text-[#1F2A44]">{e.title}</h4>
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
                    {e.body && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#5B6B8C]">
                        {e.body}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center py-8">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm text-[#5B6B8C]">暂无词条</p>
          </div>
        )}
        {isAuthor && (
          <div className="mt-6 border-t border-[#DCE9FF] pt-4">
            <p className="text-xs font-medium text-[#1F2A44]">新增词条</p>
            <input
              className="sf-input mt-2 w-full"
              placeholder="标题"
              value={newTitle}
              onChange={(ev) => setNewTitle(ev.target.value)}
            />
            <textarea
              className="sf-input mt-2 min-h-[100px] w-full resize-y"
              placeholder="正文（可选）"
              value={newBody}
              onChange={(ev) => setNewBody(ev.target.value)}
            />
            <button
              type="button"
              className="sf-btn-secondary mt-3"
              onClick={() => void addKnowledge()}
            >
              添加词条
            </button>
          </div>
        )}
      </div>

      {/* 对话区域 */}
      {sessionId && (
        <div className="rounded-xl border border-[#DCE9FF] bg-white p-6">
          <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2 mb-4">
            <span>🌍</span> 探索 {row.name}
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-4 ${
                  msg.role === "user"
                    ? "bg-[#EEF6FF] border-l-4 border-[#5B9DFF]"
                    : "bg-[#F0F9FF] border-l-4 border-[#4FACFE]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    msg.role === "user"
                      ? "bg-[#5B9DFF] text-white"
                      : "bg-[#4FACFE] text-white"
                  }`}>
                    {msg.role === "user" ? "我" : row.name}
                  </span>
                </div>
                <p className="text-sm text-[#1F2A44] leading-relaxed">{msg.content}</p>
              </div>
            ))}
            {streamText && (
              <div className="rounded-xl p-4 bg-[#F0F9FF] border-l-4 border-[#4FACFE]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#4FACFE] text-white">
                    {row.name}
                  </span>
                </div>
                <p className="text-sm text-[#1F2A44] leading-relaxed">{streamText}▌</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <input
              className="sf-input flex-1"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`探索 ${row.name} 的世界观...`}
              disabled={busy}
            />
            <button className="sf-btn-primary" onClick={sendMessage} disabled={busy || !inputMessage.trim()}>
              {busy ? "发送中..." : "探索"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
