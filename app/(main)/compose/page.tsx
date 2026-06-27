"use client";

import Link from "next/link";
import { Tooltip, message } from "antd";
import { useEffect, useState } from "react";
import { replayHeaders } from "@/lib/replay-headers";

type MyStoryItem = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

export default function ComposePage() {
  const [storyTitle] = useState("赛博朋克2077-初次相遇");
  const [storyId, setStoryId] = useState("");
  const [prompt, setPrompt] = useState("让强尼银手台词更暴躁，保持悬疑氛围。");
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const [myStories, setMyStories] = useState<MyStoryItem[]>([]);
  const [myCharacters, setMyCharacters] = useState<{ id: string; name: string }[]>([]);
  const [myWorlds, setMyWorlds] = useState<{ id: string; name: string }[]>([]);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; modelName: string; provider: string }>>([]);
  const [selectedModelId, setSelectedModelId] = useState("");

  async function createStory() {
    const res = await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: storyTitle,
        summary: "MVP 自动创建示例故事",
        tags: ["赛博朋克", "悬疑", "长篇"],
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setStoryId(json.data.id);
      await loadMyStories();
    }
  }

  async function publishStory() {
    if (!storyId) return;
    const res = await fetch(`/api/stories/${storyId}/publish`, { method: "POST", headers: replayHeaders() });
    const json = await res.json();
    if (json.code === 200) {
      message.success("发布成功");
    } else {
      message.error(json.msg || "发布失败");
    }
    await loadMyStories();
  }

  async function createSession() {
    await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "story",
        story_id: storyId || null,
        character_id: null,
        world_id: null,
        title: `${storyTitle}-会话`,
      }),
    });
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    setStreamText("");
    const sessionRes = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "story",
        story_id: storyId || null,
        title: `${storyTitle}-会话`,
        model_id: selectedModelId || undefined,
      }),
    });
    const sessionJson = await sessionRes.json();
    if (sessionJson.code !== 200) {
      setBusy(false);
      return;
    }
    const sessionId = sessionJson.data.session_id;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prompt }),
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
          const payload = JSON.parse(line.slice(5).trim()) as { type?: string; content?: string };
          if (payload.type === "content") {
            setStreamText((t) => t + payload.content);
          }
        }
      }
    } catch {
    } finally {
      setBusy(false);
    }
  }

  async function stopGenerate() {
    const sessionRes = await fetch("/api/chat/sessions");
    const sessionJson = await sessionRes.json();
    if (sessionJson.code === 200 && sessionJson.data?.length > 0) {
      const lastSession = sessionJson.data[sessionJson.data.length - 1];
      await fetch(`/api/chat/sessions/${lastSession.id}/stop`, { method: "POST" });
    }
    setBusy(false);
  }

  async function loadMyStories() {
    const res = await fetch("/api/stories?mine=1");
    const json = await res.json();
    setMyStories(json.data ?? []);
  }

  async function loadMyCards() {
    const [charRes, worldRes, modelRes] = await Promise.all([
      fetch("/api/characters?mine=1"),
      fetch("/api/worlds?mine=1"),
      fetch("/api/models"),
    ]);
    const charJson = charRes.ok ? await charRes.json() : { data: [] };
    const worldJson = worldRes.ok ? await worldRes.json() : { data: [] };
    setMyCharacters((charJson.data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    setMyWorlds((worldJson.data ?? []).map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));
    if (modelRes.ok) {
      const modelJson = await modelRes.json();
      if (modelJson.code === 200) {
        const enabled = (modelJson.data ?? []).filter((m: { enabled: boolean }) => m.enabled);
        setAvailableModels(enabled);
        if (modelJson.defaultModelId) setSelectedModelId(modelJson.defaultModelId);
        else if (enabled.length > 0) setSelectedModelId(enabled[0].id);
      }
    }
  }

  useEffect(() => {
    void loadMyStories();
    void loadMyCards();
  }, []);

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="section-title">创作工作台</h2>
          <p className="section-subtitle">创建故事、与 AI 对话，开启你的创作之旅</p>
        </div>
        <div className="flex gap-3">
          <button className="sf-btn-primary" onClick={createStory}>
            新建故事
          </button>
          <Tooltip title={!storyId ? "请先创建或选择一个故事" : undefined}>
            <button
              className="sf-btn-secondary"
              onClick={publishStory}
              disabled={!storyId}
            >
              发布故事
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 三栏布局 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,320px)]">
        {/* 左侧 - 章节大纲 */}
        <div className="rounded-2xl border border-[#dce9ff] bg-white p-5">
          <h3 className="text-base font-semibold text-[#1f2a44] mb-4 flex items-center gap-2">
            <span className="text-xl">📚</span> 章节大纲
          </h3>
          {storyId ? (
            <Link
              className="inline-flex items-center gap-2 text-sm font-medium text-[#3f86f5] hover:underline"
              href={`/stories/${storyId}/edit`}
            >
              <span>🔗</span> 打开大纲编辑器
            </Link>
          ) : (
            <p className="text-sm text-[#5b6b8c]">先创建故事后，可编辑树形章节节点。</p>
          )}
          <div className="mt-4 border-t border-dashed border-[#dce9ff] pt-4">
            <p className="text-xs font-medium text-[#1f2a44] mb-3">我的故事</p>
            <ul className="space-y-2">
              {myStories.slice(0, 5).map((story) => (
                <li
                  key={story.id}
                  className={`cursor-pointer rounded-lg p-2 text-sm transition-colors ${
                    storyId === story.id ? "bg-[#eef6ff]" : "bg-[#f8fbff] hover:bg-[#f0f6ff]"
                  }`}
                  onClick={() => setStoryId(story.id)}
                >
                  <p className="font-medium text-[#1f2a44] truncate">{story.title}</p>
                  <p className="text-xs text-[#5b6b8c]">状态: {STATUS_LABELS[story.status] ?? story.status}</p>
                </li>
              ))}
              {myStories.length === 0 && (
                <li className="text-xs text-[#5b6b8c] text-center py-4">暂无故事</li>
              )}
            </ul>
          </div>
        </div>

        {/* 中间 - 正文编辑区 */}
        <div className="rounded-2xl border border-[#dce9ff] bg-white p-5">
          <h3 className="text-base font-semibold text-[#1f2a44] mb-4 flex items-center gap-2">
            <span className="text-xl">✍️</span> 正文编辑区
          </h3>
          <textarea
            className="sf-input min-h-48 resize-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入你的创作指令..."
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {availableModels.length > 0 && (
              <select
                className="sf-input max-w-[200px] text-sm"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                ))}
              </select>
            )}
            {availableModels.length === 0 && (
              <Link href="/settings" className="text-xs text-[#5B9DFF] hover:underline">
                前往设置添加 AI 模型
              </Link>
            )}
            <Tooltip title={availableModels.length === 0 ? "请先在设置中添加 AI 模型" : undefined}>
              <button
                className="sf-btn-primary flex items-center gap-2"
                onClick={generate}
                disabled={busy || availableModels.length === 0}
              >
                {busy ? (
                  <>
                    <span className="animate-pulse">⏳</span> 生成中...
                  </>
                ) : (
                  <>
                    <span>✨</span> AI 续写
                  </>
                )}
              </button>
            </Tooltip>
            <Tooltip title={!busy ? "当前没有正在生成的内容" : undefined}>
              <button
                className="sf-btn-secondary flex items-center gap-2"
                onClick={stopGenerate}
                disabled={!busy}
              >
                <span>⏹</span> 停止生成
              </button>
            </Tooltip>
            <Tooltip title={!storyId ? "请先创建或选择一个故事" : undefined}>
              <button
                className="sf-btn-secondary flex items-center gap-2"
                onClick={createSession}
                disabled={!storyId}
              >
                <span>💬</span> 创建会话
              </button>
            </Tooltip>
          </div>
          <div className="mt-5 rounded-xl bg-[#eef6ff] p-5 min-h-[300px]">
            <p className="font-semibold text-[#1f2a44] mb-2 flex items-center gap-2">
              <span>📤</span> 输出结果
            </p>
            <p className="text-sm text-[#1f2a44] whitespace-pre-wrap leading-relaxed">
              {streamText || "暂无输出，点击 AI 续写开始创作"}
            </p>
          </div>
        </div>

        {/* 右侧 - 角色与世界 */}
        <div className="rounded-2xl border border-[#dce9ff] bg-white p-5">
          <h3 className="text-base font-semibold text-[#1f2a44] mb-4 flex items-center gap-2">
            <span className="text-xl">🎭</span> 角色与世界
          </h3>
          <div className="flex flex-wrap gap-2">
            {myCharacters.length > 0 ? (
              myCharacters.slice(0, 5).map((c) => (
                <Link key={c.id} className="sf-tag" href={`/characters/${c.id}`}>
                  {c.name}
                </Link>
              ))
            ) : (
              <span className="text-xs text-[#5b6b8c]">暂无角色</span>
            )}
            {myWorlds.length > 0 ? (
              myWorlds.slice(0, 5).map((w) => (
                <Link key={w.id} className="sf-tag" href={`/worlds/${w.id}`}>
                  {w.name}
                </Link>
              ))
            ) : (
              <span className="text-xs text-[#5b6b8c]">暂无世界</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="sf-tag text-xs" href="/characters/new">+ 新建角色</Link>
            <Link className="sf-tag text-xs" href="/worlds/new">+ 新建世界</Link>
          </div>
          <div className="mt-4 border-t border-dashed border-[#dce9ff] pt-4">
            <p className="text-xs font-medium text-[#1f2a44] mb-3">快捷操作</p>
            <div className="space-y-2">
              <Tooltip title={!storyId ? "请先创建或选择一个故事" : undefined}>
                <button
                  className="w-full sf-tag text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={createSession}
                  disabled={!storyId}
                >
                  + 创建新会话
                </button>
              </Tooltip>
              {storyId && (
                <button className="w-full sf-tag text-left" onClick={publishStory}>
                  + 发布当前故事
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
