/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type FeedItem = {
  id: string;
  title: string;
  summary: string;
  like_count: number;
  author_id: string;
};

type NotificationItem = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  is_read: number;
  created_at: string;
};

type MyStoryItem = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
};

type StoryDetail = {
  id: string;
  author_id: string;
  title: string;
  summary: string;
  status: string;
  tags_json: string;
  like_count: number;
  publish_at: string | null;
  updated_at: string;
};

type SessionItem = {
  id: string;
  title: string;
  story_id: string | null;
  updated_at: string;
};

type MessageItem = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
};

export default function Home() {
  const [storyTitle] = useState("赛博朋克2077-初次相遇");
  const [storyId, setStoryId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [prompt, setPrompt] = useState("让强尼银手台词更暴躁，保持悬疑氛围。");
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedSort, setFeedSort] = useState("recommended");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [myStories, setMyStories] = useState<MyStoryItem[]>([]);
  const [selectedStoryDetail, setSelectedStoryDetail] = useState<StoryDetail | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionForHistory, setSelectedSessionForHistory] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [sessionFrom, setSessionFrom] = useState("");
  const [sessionTo, setSessionTo] = useState("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const seqRef = useRef(0);

  const logs = useMemo(() => logLines.slice(-8), [logLines]);

  function pushLog(line: string) {
    setLogLines((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  }

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
      pushLog(`故事创建成功: ${json.data.id}`);
      await loadMyStories();
    } else {
      pushLog(`故事创建失败: ${json.msg}`);
    }
  }

  async function publishStory() {
    if (!storyId) {
      pushLog("请先创建故事");
      return;
    }
    const res = await fetch(`/api/stories/${storyId}/publish`, { method: "POST" });
    const json = await res.json();
    pushLog(json.msg ?? "发布完成");
    await loadMyStories();
    await loadFeed(feedSort);
  }

  async function unpublishStory(targetStoryId: string) {
    const res = await fetch(`/api/stories/${targetStoryId}/unpublish`, { method: "POST" });
    const json = await res.json();
    pushLog(json.msg ?? "已下架");
    await loadMyStories();
    await loadFeed(feedSort);
  }

  async function createSession() {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: "story",
        story_id: storyId || null,
        character_id: null,
        world_id: "world_cyberpunk_001",
        title: `${storyTitle}-会话`,
      }),
    });
    const json = await res.json();
    if (json.code === 200) {
      setSessionId(json.data.session_id);
      setSelectedSessionForHistory(json.data.session_id);
      pushLog(`会话创建成功: ${json.data.session_id}`);
      await loadSessions(storyId || undefined);
    } else {
      pushLog(`会话创建失败: ${json.msg}`);
    }
  }

  async function generate() {
    if (!sessionId) {
      pushLog("请先创建会话");
      return;
    }
    setBusy(true);
    setStreamText("");
    seqRef.current = 0;
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prompt }),
      });
      if (!res.body) {
        pushLog("流式返回为空");
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
            seqRef.current = payload.seq;
            setStreamText((t) => t + payload.content);
          } else if (payload.type === "done") {
            pushLog(`生成完成，seq=${payload.seq ?? seqRef.current}`);
          }
        }
      }
    } catch (err) {
      pushLog(`生成失败: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function stopGenerate() {
    if (!sessionId) return;
    await fetch(`/api/chat/sessions/${sessionId}/stop`, { method: "POST" });
    setBusy(false);
    pushLog("已发送停止指令");
  }

  async function loadFeed(sort = feedSort) {
    const res = await fetch(`/api/feed?sort=${sort}`);
    const json = await res.json();
    setFeed(json.data.items ?? []);
    setFeedSort(sort);
    pushLog(`推荐流已刷新(${sort})，共 ${json.data.items?.length ?? 0} 条`);
  }

  async function likeStory(targetId: string) {
    const res = await fetch("/api/likes/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "story", target_id: targetId }),
    });
    const json = await res.json();
    pushLog(`${targetId} ${json.msg}`);
    await loadFeed(feedSort);
    await loadNotifications();
  }

  async function followAuthor(authorId: string) {
    const res = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: authorId }),
    });
    const json = await res.json();
    pushLog(`作者 ${authorId} ${json.msg}`);
    await loadFeed(feedSort);
    await loadNotifications();
  }

  async function loadNotifications() {
    const [listRes, unreadRes] = await Promise.all([
      fetch("/api/notifications?page=1&page_size=10"),
      fetch("/api/notifications/unread-count"),
    ]);
    const listJson = await listRes.json();
    const unreadJson = await unreadRes.json();
    setNotifications(listJson.data ?? []);
    setUnread(unreadJson.data?.unread ?? 0);
  }

  async function loadMyStories() {
    const res = await fetch("/api/stories?mine=1");
    const json = await res.json();
    setMyStories(json.data ?? []);
  }

  async function viewStoryDetail(targetStoryId: string) {
    const res = await fetch(`/api/stories/${targetStoryId}`);
    const json = await res.json();
    if (json.code === 200) {
      setSelectedStoryDetail(json.data);
      setStoryId(targetStoryId);
      await loadSessions(targetStoryId);
      pushLog(`已加载故事详情: ${targetStoryId}`);
    } else {
      pushLog(json.msg ?? "加载详情失败");
    }
  }

  async function loadSessions(storyIdParam?: string) {
    const params = new URLSearchParams();
    if (storyIdParam) params.set("story_id", storyIdParam);
    if (sessionKeyword.trim()) params.set("q", sessionKeyword.trim());
    if (sessionFrom) params.set("from", sessionFrom);
    if (sessionTo) params.set("to", sessionTo);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/chat/sessions${query}`);
    const json = await res.json();
    const list: SessionItem[] = json.data ?? [];
    setSessions(list);
    if (list.length > 0 && !selectedSessionForHistory) {
      setSelectedSessionForHistory(list[0].id);
    }
  }

  async function loadMessages(sessionIdParam: string, page = 1) {
    const res = await fetch(
      `/api/chat/sessions/${sessionIdParam}/messages?page=${page}&page_size=20`,
    );
    const json = await res.json();
    setMessages(json.data ?? []);
    setMessagePage(page);
  }

  async function markAllRead() {
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const json = await res.json();
    pushLog(json.msg ?? "已读完成");
    await loadNotifications();
  }

  useEffect(() => {
    void (async () => {
      const feedRes = await fetch("/api/feed?sort=recommended");
      const feedJson = await feedRes.json();
      setFeed(feedJson.data.items ?? []);

      const [listRes, unreadRes] = await Promise.all([
        fetch("/api/notifications?page=1&page_size=10"),
        fetch("/api/notifications/unread-count"),
      ]);
      const listJson = await listRes.json();
      const unreadJson = await unreadRes.json();
      setNotifications(listJson.data ?? []);
      setUnread(unreadJson.data?.unread ?? 0);

      const mineRes = await fetch("/api/stories?mine=1");
      const mineJson = await mineRes.json();
      setMyStories(mineJson.data ?? []);

      const sessionRes = await fetch("/api/chat/sessions?page=1&page_size=20");
      const sessionJson = await sessionRes.json();
      setSessions(sessionJson.data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSessionForHistory) return;
    void loadMessages(selectedSessionForHistory, 1);
  }, [selectedSessionForHistory]);

  function formatNotification(item: NotificationItem) {
    const payload = item.payload ?? {};
    if (item.type === "liked") {
      return `有人点赞了你的作品《${String(payload.story_title ?? "")}》`;
    }
    if (item.type === "followed") {
      return "你新增了一位关注者";
    }
    if (item.type === "author_update") {
      return `你关注的作者发布了新作品《${String(payload.story_title ?? "")}》`;
    }
    return "系统通知";
  }

  return (
    <div className="min-h-screen bg-[#F8FBFF] p-4 md:p-6">
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <aside className="sf-card p-4">
          <h1 className="text-xl font-semibold text-[#1F2A44]">StoryForge</h1>
          <p className="mt-1 text-xs text-[#5B6B8C]">MVP / 酒馆对话版本</p>
          <nav className="mt-5 space-y-2 text-sm">
            <div className="rounded-lg bg-[#EEF6FF] px-3 py-2 font-medium text-[#3F86F5]">
              市场
            </div>
            <div className="rounded-lg px-3 py-2 text-[#5B6B8C]">创作</div>
            <div className="rounded-lg px-3 py-2 text-[#5B6B8C]">设置</div>
          </nav>
          <div className="mt-6 rounded-lg bg-[#EEF6FF] p-3 text-xs text-[#3F86F5]">
            未读通知：{unread}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="sf-card p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#1F2A44]">创作工作台</h2>
                <p className="text-sm text-[#5B6B8C]">可直接测试故事创建、会话创建与流式续写。</p>
              </div>
              <div className="flex gap-2">
                <button className="sf-btn-primary w-fit" onClick={createStory}>
                  新建故事
                </button>
                <button
                  className="rounded-lg border border-[#DCE9FF] px-3 py-2 text-sm"
                  onClick={publishStory}
                >
                  发布故事
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_260px]">
              <div className="rounded-xl border border-[#DCE9FF] bg-white p-3">
                <p className="text-sm font-medium">章节大纲</p>
                <ul className="mt-2 space-y-2 text-sm text-[#5B6B8C]">
                  <li>第1章：夜雨开场</li>
                  <li>第2章：角色登场</li>
                  <li>分支A：追踪线</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[#DCE9FF] bg-white p-3">
                <p className="text-sm font-medium">正文编辑区</p>
                <textarea
                  className="sf-input mt-2 min-h-36"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <button className="sf-btn-primary" onClick={generate} disabled={busy}>
                    {busy ? "生成中..." : "AI 续写"}
                  </button>
                  <button
                    className="rounded-lg border border-[#DCE9FF] px-3 py-2 text-sm"
                    onClick={stopGenerate}
                  >
                    停止生成
                  </button>
                  <button
                    className="rounded-lg border border-[#DCE9FF] px-3 py-2 text-sm"
                    onClick={createSession}
                  >
                    创建会话
                  </button>
                </div>
                <div className="mt-3 rounded-lg bg-[#EEF6FF] p-3 text-sm text-[#1F2A44]">
                  <p className="font-medium">流式输出</p>
                  <p className="mt-1 whitespace-pre-wrap">{streamText || "暂无输出"}</p>
                </div>
              </div>
              <div className="rounded-xl border border-[#DCE9FF] bg-white p-3">
                <p className="text-sm font-medium">角色/世界卡</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="sf-tag">角色: V</span>
                  <span className="sf-tag">角色: 强尼</span>
                  <span className="sf-tag">世界: 赛博朋克</span>
                </div>
                <div className="mt-4 space-y-2 text-xs text-[#5B6B8C]">
                  <p>story_id: {storyId || "未创建"}</p>
                  <p>session_id: {sessionId || "未创建"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="sf-card p-4 md:p-5">
            <h2 className="text-lg font-semibold text-[#1F2A44]">市场列表（推荐流）</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="sf-tag" onClick={() => loadFeed("latest")}>
                最新
              </button>
              <button className="sf-tag" onClick={() => loadFeed("updated")}>
                更新时间
              </button>
              <button className="sf-tag" onClick={() => loadFeed("recommended")}>
                推荐
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {feed.map((item) => (
                <article key={item.id} className="rounded-xl border border-[#DCE9FF] bg-white p-3">
                  <h3 className="font-medium text-[#1F2A44]">{item.title}</h3>
                  <p className="mt-1 text-sm text-[#5B6B8C]">
                    {item.summary || "支持点赞、关注、通知与基础推荐排序。"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-[#5B6B8C]">
                    <span>点赞: {item.like_count}</span>
                    <div className="flex gap-2">
                      <button className="sf-tag" onClick={() => likeStory(item.id)}>
                        点赞/取消
                      </button>
                      <button className="sf-tag" onClick={() => viewStoryDetail(item.id)}>
                        查看详情
                      </button>
                      <Link className="sf-tag" href={`/stories/${item.id}`}>
                        详情页
                      </Link>
                      <button className="sf-tag" onClick={() => followAuthor(item.author_id)}>
                        关注作者
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {feed.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#DCE9FF] bg-white p-3 text-sm text-[#5B6B8C]">
                  暂无已发布故事。先新建故事并发布，再刷新推荐流。
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[#DCE9FF] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#1F2A44]">通知中心</p>
                <div className="flex gap-2">
                  <button className="sf-tag" onClick={loadNotifications}>
                    刷新
                  </button>
                  <button className="sf-tag" onClick={markAllRead}>
                    全部已读
                  </button>
                </div>
              </div>
              <ul className="mt-2 space-y-2 text-xs text-[#5B6B8C]">
                {notifications.map((item) => (
                  <li key={item.id} className="rounded-lg bg-[#F8FBFF] p-2">
                    <span className="font-medium text-[#1F2A44]">[{item.type}] </span>
                    {formatNotification(item)}
                    {typeof item.payload.story_id === "string" && (
                      <button
                        className="ml-2 sf-tag"
                        onClick={() => viewStoryDetail(String(item.payload.story_id))}
                      >
                        查看
                      </button>
                    )}
                  </li>
                ))}
                {notifications.length === 0 && <li>暂无通知</li>}
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[#DCE9FF] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#1F2A44]">我的故事</p>
                <button className="sf-tag" onClick={loadMyStories}>
                  刷新
                </button>
              </div>
              <ul className="mt-2 space-y-2 text-xs text-[#5B6B8C]">
                {myStories.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-[#F8FBFF] p-2"
                  >
                    <div>
                      <p className="font-medium text-[#1F2A44]">{item.title}</p>
                      <p>状态：{item.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="sf-tag"
                        onClick={() => setStoryId(item.id)}
                        title="设为当前故事"
                      >
                        设为当前
                      </button>
                      {item.status === "published" ? (
                        <button className="sf-tag" onClick={() => unpublishStory(item.id)}>
                          下架
                        </button>
                      ) : (
                        <button
                          className="sf-tag"
                          onClick={async () => {
                            const res = await fetch(`/api/stories/${item.id}/publish`, {
                              method: "POST",
                            });
                            const json = await res.json();
                            pushLog(`${item.title}: ${json.msg}`);
                            await loadMyStories();
                            await loadFeed(feedSort);
                          }}
                        >
                          发布
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {myStories.length === 0 && <li>暂无我的故事</li>}
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[#DCE9FF] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#1F2A44]">故事详情</p>
                {selectedStoryDetail && (
                  <button
                    className="sf-tag"
                    onClick={async () => {
                      await createSession();
                    }}
                  >
                    基于该故事创建会话
                  </button>
                )}
              </div>
              {selectedStoryDetail ? (
                <div className="mt-2 text-xs text-[#5B6B8C]">
                  <p className="font-medium text-[#1F2A44]">{selectedStoryDetail.title}</p>
                  <p className="mt-1">{selectedStoryDetail.summary || "暂无简介"}</p>
                  <p className="mt-1">状态：{selectedStoryDetail.status}</p>
                  <p className="mt-1">点赞：{selectedStoryDetail.like_count}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#5B6B8C]">点击推荐卡片中的“查看详情”加载。</p>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[#DCE9FF] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#1F2A44]">会话历史</p>
                <div className="flex gap-2">
                  <input
                    className="sf-input w-40 text-xs"
                    placeholder="标题关键词"
                    value={sessionKeyword}
                    onChange={(e) => setSessionKeyword(e.target.value)}
                  />
                  <input
                    className="sf-input w-36 text-xs"
                    type="date"
                    value={sessionFrom}
                    onChange={(e) => setSessionFrom(e.target.value)}
                  />
                  <input
                    className="sf-input w-36 text-xs"
                    type="date"
                    value={sessionTo}
                    onChange={(e) => setSessionTo(e.target.value)}
                  />
                  <button
                    className="sf-tag"
                    onClick={() => loadSessions(storyId || selectedStoryDetail?.id)}
                  >
                    搜索/刷新
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
                <ul className="space-y-2 text-xs">
                  {sessions.map((s) => (
                    <li
                      key={s.id}
                      className={`cursor-pointer rounded-lg p-2 ${
                        selectedSessionForHistory === s.id ? "bg-[#EEF6FF]" : "bg-[#F8FBFF]"
                      }`}
                      onClick={() => setSelectedSessionForHistory(s.id)}
                    >
                      <p className="font-medium text-[#1F2A44]">{s.title}</p>
                      <p className="text-[#5B6B8C]">{s.id}</p>
                    </li>
                  ))}
                  {sessions.length === 0 && <li className="text-[#5B6B8C]">暂无会话</li>}
                </ul>
                <div>
                  <div className="space-y-2 text-xs text-[#5B6B8C]">
                    {messages.map((m) => (
                      <div key={m.id} className="rounded-lg bg-[#F8FBFF] p-2">
                        <span className="font-medium text-[#1F2A44]">[{m.role}] </span>
                        {m.content}
                      </div>
                    ))}
                    {messages.length === 0 && <div>暂无消息</div>}
                  </div>
                  {selectedSessionForHistory && (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="sf-tag"
                        onClick={() =>
                          loadMessages(selectedSessionForHistory, Math.max(1, messagePage - 1))
                        }
                      >
                        上一页
                      </button>
                      <button
                        className="sf-tag"
                        onClick={() => loadMessages(selectedSessionForHistory, messagePage + 1)}
                      >
                        下一页
                      </button>
                      <span className="text-xs text-[#5B6B8C]">第 {messagePage} 页</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#DCE9FF] bg-white p-3">
              <p className="text-sm font-medium text-[#1F2A44]">运行日志</p>
              <ul className="mt-2 space-y-1 text-xs text-[#5B6B8C]">
                {logs.map((l) => (
                  <li key={l}>{l}</li>
                ))}
                {logs.length === 0 && <li>暂无日志</li>}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
