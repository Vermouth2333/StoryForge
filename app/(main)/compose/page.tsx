/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MyStoryItem = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
};

export default function ComposePage() {
  const [storyTitle] = useState("赛博朋克2077-初次相遇");
  const [storyId, setStoryId] = useState("");
  const [prompt, setPrompt] = useState("让强尼银手台词更暴躁，保持悬疑氛围。");
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const [myStories, setMyStories] = useState<MyStoryItem[]>([]);

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
    await fetch(`/api/stories/${storyId}/publish`, { method: "POST" });
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
          const payload = JSON.parse(line.slice(5).trim()) as any;
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

  useEffect(() => {
    void loadMyStories();
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
          <button className="sf-btn-secondary" onClick={publishStory}>
            发布故事
          </button>
        </div>
      </div>

      {/* 三栏布局 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_280px]">
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
                  <p className="text-xs text-[#5b6b8c]">状态: {story.status}</p>
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
            className="sf-input min-h-32 resize-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入你的创作指令..."
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="sf-btn-primary flex items-center gap-2" onClick={generate} disabled={busy}>
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
            <button className="sf-btn-secondary flex items-center gap-2" onClick={stopGenerate}>
              <span>⏹</span> 停止生成
            </button>
            <button className="sf-btn-secondary flex items-center gap-2" onClick={createSession}>
              <span>💬</span> 创建会话
            </button>
          </div>
          <div className="mt-5 rounded-xl bg-[#eef6ff] p-5">
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
            <span className="sf-tag">角色: V</span>
            <span className="sf-tag">角色: 强尼</span>
            <span className="sf-tag">世界: 赛博朋克</span>
          </div>
          <div className="mt-4 border-t border-dashed border-[#dce9ff] pt-4">
            <p className="text-xs font-medium text-[#1f2a44] mb-3">快捷操作</p>
            <div className="space-y-2">
              <button className="w-full sf-tag text-left" onClick={createSession}>
                + 创建新会话
              </button>
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
