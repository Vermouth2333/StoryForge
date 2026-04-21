/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type FeedItem = {
  id: string;
  title: string;
  summary: string;
  like_count: number;
  favorite_count?: number;
  author_id: string;
  author_display?: string;
  feed_kind?: "story" | "character" | "world";
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

type MyCharacterItem = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
};

type MyWorldItem = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
};

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

type SessionSnapshotItem = {
  id: string;
  session_id: string;
  label: string;
  payload: { last_message_id?: string; last_message_at?: string };
  created_at: string;
};

type FavoriteRow = {
  favorite_row_id: string;
  target_type: string;
  target_id: string;
  created_at: string;
  title: string | null;
  summary: string | null;
  author_id: string | null;
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
  const [marketTab, setMarketTab] = useState<"story" | "character" | "world">("story");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [myStories, setMyStories] = useState<MyStoryItem[]>([]);
  const [myCharacters, setMyCharacters] = useState<MyCharacterItem[]>([]);
  const [myWorlds, setMyWorlds] = useState<MyWorldItem[]>([]);
  const [myFavorites, setMyFavorites] = useState<FavoriteRow[]>([]);
  const [selectedStoryDetail, setSelectedStoryDetail] = useState<StoryDetail | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionForHistory, setSelectedSessionForHistory] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [sessionFrom, setSessionFrom] = useState("");
  const [sessionTo, setSessionTo] = useState("");
  const [sessionSnapshots, setSessionSnapshots] = useState<SessionSnapshotItem[]>([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");
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
    await loadFeed(feedSort, marketTab);
  }

  async function unpublishStory(targetStoryId: string) {
    const res = await fetch(`/api/stories/${targetStoryId}/unpublish`, { method: "POST" });
    const json = await res.json();
    pushLog(json.msg ?? "已下架");
    await loadMyStories();
    await loadFeed(feedSort, marketTab);
  }

  async function createSession() {
    const res = await fetch("/api/chat/sessions", {
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
            if (payload.reason === "timeout") {
              pushLog("生成超时，连接已结束");
            } else if (payload.reason === "stopped") {
              pushLog(`已停止生成，seq=${payload.seq ?? seqRef.current}`);
            } else {
              pushLog(`生成完成，seq=${payload.seq ?? seqRef.current}`);
            }
          } else if (payload.type === "heartbeat") {
            /* 保活，无需写入日志 */
          } else if (payload.type === "error") {
            pushLog(`生成错误: ${payload.msg ?? "unknown"}`);
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

  async function loadFeed(sort = feedSort, tab = marketTab) {
    const kind = tab === "story" ? "story" : tab === "character" ? "character" : "world";
    const res = await fetch(`/api/feed?sort=${sort}&kind=${kind}`);
    const json = await res.json();
    setFeed(json.data.items ?? []);
    setFeedSort(sort);
    setMarketTab(tab);
    pushLog(`推荐流已刷新(${tab}/${sort})，共 ${json.data.items?.length ?? 0} 条`);
  }

  async function likeFeedItem(targetId: string, kind: FeedItem["feed_kind"]) {
    const target_type = kind ?? "story";
    const res = await fetch("/api/likes/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type, target_id: targetId }),
    });
    const json = await res.json();
    pushLog(`${target_type} ${targetId} ${json.msg}`);
    await loadFeed(feedSort, marketTab);
    await loadNotifications();
    await loadMyFavorites();
  }

  async function followAuthor(authorId: string) {
    const res = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: authorId }),
    });
    const json = await res.json();
    pushLog(`作者 ${authorId} ${json.msg}`);
    await loadFeed(feedSort, marketTab);
    await loadNotifications();
  }

  async function loadMyFavorites() {
    const res = await fetch("/api/favorites?limit=50");
    const json = await res.json();
    setMyFavorites(json.data ?? []);
  }

  async function favoriteFeedItem(targetId: string, kind: FeedItem["feed_kind"]) {
    const target_type = kind ?? "story";
    const res = await fetch("/api/favorites/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type, target_id: targetId }),
    });
    const json = await res.json();
    pushLog(`${target_type} ${targetId} ${json.msg}`);
    await loadFeed(feedSort, marketTab);
    await loadMyFavorites();
    await loadNotifications();
  }

  async function loadNotifications() {
    const listRes = await fetch("/api/notifications?page=1&page_size=10");
    const listJson = await listRes.json();
    setNotifications(listJson.data ?? []);
  }

  async function loadMyStories() {
    const res = await fetch("/api/stories?mine=1");
    const json = await res.json();
    setMyStories(json.data ?? []);
  }

  async function loadMyCharacters() {
    const res = await fetch("/api/characters?mine=1");
    const json = await res.json();
    setMyCharacters(json.data ?? []);
  }

  async function loadMyWorlds() {
    const res = await fetch("/api/worlds?mine=1");
    const json = await res.json();
    setMyWorlds(json.data ?? []);
  }

  async function createSampleCharacter() {
    const res = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `示例角色-${Date.now().toString(36)}`,
        summary: "市场「角色」分类示例卡",
        personality: "冷静、寡言，关键时刻果断。",
        tags: ["示例", "悬疑"],
      }),
    });
    const json = await res.json();
    pushLog(json.msg ?? "角色创建结果");
    await loadMyCharacters();
  }

  async function createSampleWorld() {
    const res = await fetch("/api/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `示例世界-${Date.now().toString(36)}`,
        summary: "市场「世界」分类示例卡",
        setting_notes: "低科技都市，阴雨连绵，企业垄断资源。",
        tags: ["赛博朋克", "短篇"],
      }),
    });
    const json = await res.json();
    pushLog(json.msg ?? "世界创建结果");
    await loadMyWorlds();
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

  async function loadSessionSnapshots(sid: string) {
    const res = await fetch(`/api/chat/sessions/${sid}/snapshots`);
    const json = await res.json();
    if (json.code !== 200) {
      setSessionSnapshots([]);
      return;
    }
    setSessionSnapshots(json.data?.snapshots ?? []);
  }

  async function createSessionSnapshot() {
    if (!selectedSessionForHistory) {
      pushLog("请先选择会话");
      return;
    }
    const res = await fetch(`/api/chat/sessions/${selectedSessionForHistory}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: snapshotLabel.trim() }),
    });
    const json = await res.json();
    if (json.code === 200) {
      pushLog(`已创建快照: ${json.data.snapshot.id}`);
      await loadSessionSnapshots(selectedSessionForHistory);
      setSnapshotLabel("");
    } else {
      pushLog(json.msg ?? "创建快照失败");
    }
  }

  async function restoreSessionSnapshot(snapshotId: string) {
    if (!selectedSessionForHistory) return;
    if (
      !window.confirm("将删除该快照时间点之后的所有消息，确定恢复到此检查点吗？")
    ) {
      return;
    }
    const res = await fetch(
      `/api/chat/sessions/${selectedSessionForHistory}/snapshots/${snapshotId}/restore`,
      { method: "POST" },
    );
    const json = await res.json();
    if (json.code === 200) {
      pushLog(`已恢复，删除消息数: ${json.data.deleted_messages}`);
      await loadMessages(selectedSessionForHistory, 1);
      await loadSessionSnapshots(selectedSessionForHistory);
    } else {
      pushLog(json.msg ?? "恢复失败");
    }
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
      const feedRes = await fetch("/api/feed?sort=recommended&kind=story");
      const feedJson = await feedRes.json();
      setFeed(feedJson.data.items ?? []);

      const listRes = await fetch("/api/notifications?page=1&page_size=10");
      const listJson = await listRes.json();
      setNotifications(listJson.data ?? []);

      const mineRes = await fetch("/api/stories?mine=1");
      const mineJson = await mineRes.json();
      setMyStories(mineJson.data ?? []);

      const [charRes, worldRes] = await Promise.all([
        fetch("/api/characters?mine=1"),
        fetch("/api/worlds?mine=1"),
      ]);
      const charJson = await charRes.json();
      const worldJson = await worldRes.json();
      setMyCharacters(charJson.data ?? []);
      setMyWorlds(worldJson.data ?? []);

      const sessionRes = await fetch("/api/chat/sessions?page=1&page_size=20");
      const sessionJson = await sessionRes.json();
      setSessions(sessionJson.data ?? []);

      const favRes = await fetch("/api/favorites?limit=50");
      const favJson = await favRes.json();
      setMyFavorites(favJson.data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSessionForHistory) return;
    void loadMessages(selectedSessionForHistory, 1);
    void loadSessionSnapshots(selectedSessionForHistory);
  }, [selectedSessionForHistory]);

  function formatNotification(item: NotificationItem) {
    const payload = item.payload ?? {};
    const title = String(payload.story_title ?? "");
    if (item.type === "favorited") {
      const kind = payload.content_kind as string | undefined;
      if (kind === "character") return `有人收藏了你的角色《${title}》`;
      if (kind === "world") return `有人收藏了你的世界《${title}》`;
      return `有人收藏了你的作品《${title}》`;
    }
    if (item.type === "liked") {
      const kind = payload.content_kind as string | undefined;
      if (kind === "character") return `有人点赞了你的角色《${title}》`;
      if (kind === "world") return `有人点赞了你的世界《${title}》`;
      return `有人点赞了你的作品《${title}》`;
    }
    if (item.type === "followed") {
      return "你新增了一位关注者";
    }
    if (item.type === "author_update") {
      const kind = payload.content_kind as string | undefined;
      if (kind === "character") return `你关注的作者发布了新角色《${title}》`;
      if (kind === "world") return `你关注的作者发布了新世界《${title}》`;
      return `你关注的作者发布了新作品《${title}》`;
    }
    return "系统通知";
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4">
          <div id="compose" className="sf-card scroll-mt-24 p-4 md:p-5">
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
                {storyId ? (
                  <Link
                    className="mt-2 inline-block text-sm text-[#3F86F5] underline"
                    href={`/stories/${storyId}/edit`}
                  >
                    打开大纲编辑器
                  </Link>
                ) : (
                  <p className="mt-2 text-sm text-[#5B6B8C]">先创建故事后，可编辑树形章节节点。</p>
                )}
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

          <div id="market" className="sf-card scroll-mt-28 p-4 md:p-5 md:scroll-mt-24">
            <h2 className="text-lg font-semibold text-[#1F2A44]">市场（故事 / 角色 / 世界）</h2>
            <p className="mt-1 text-sm text-[#5B6B8C]">
              与文档 4.1 一致：三个分类 Tab；排序与推荐公式沿用故事维度的加权逻辑。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={marketTab === "story" ? "sf-tag ring-2 ring-[#5B9DFF]" : "sf-tag"}
                onClick={() => loadFeed(feedSort, "story")}
              >
                故事
              </button>
              <button
                className={marketTab === "character" ? "sf-tag ring-2 ring-[#5B9DFF]" : "sf-tag"}
                onClick={() => loadFeed(feedSort, "character")}
              >
                角色
              </button>
              <button
                className={marketTab === "world" ? "sf-tag ring-2 ring-[#5B9DFF]" : "sf-tag"}
                onClick={() => loadFeed(feedSort, "world")}
              >
                世界
              </button>
              <span className="mx-1 text-[#DCE9FF]">|</span>
              <button className="sf-tag" onClick={() => loadFeed("latest", marketTab)}>
                最新
              </button>
              <button className="sf-tag" onClick={() => loadFeed("updated", marketTab)}>
                更新时间
              </button>
              <button className="sf-tag" onClick={() => loadFeed("recommended", marketTab)}>
                推荐
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {feed.map((item) => {
                const kind = item.feed_kind ?? "story";
                const detailHref =
                  kind === "character"
                    ? `/characters/${item.id}`
                    : kind === "world"
                      ? `/worlds/${item.id}`
                      : `/stories/${item.id}`;
                return (
                  <article key={`${kind}-${item.id}`} className="rounded-xl border border-[#DCE9FF] bg-white p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-[#5B9DFF]">
                      {kind === "story" ? "故事" : kind === "character" ? "角色" : "世界"}
                    </p>
                    <h3 className="font-medium text-[#1F2A44]">{item.title}</h3>
                    <p className="mt-1 text-sm text-[#5B6B8C]">
                      {item.summary || "支持点赞、关注、通知与基础推荐排序。"}
                    </p>
                    <p className="mt-1 text-xs text-[#5B6B8C]">
                      作者：{item.author_display ?? item.author_id}
                    </p>
                    <div className="mt-2 flex flex-col gap-2 text-xs text-[#5B6B8C] sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        点赞 {item.like_count} · 收藏 {Number(item.favorite_count ?? 0)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button className="sf-tag" onClick={() => likeFeedItem(item.id, kind)}>
                          点赞/取消
                        </button>
                        <button className="sf-tag" onClick={() => favoriteFeedItem(item.id, kind)}>
                          收藏/取消
                        </button>
                        {kind === "story" ? (
                          <button className="sf-tag" onClick={() => viewStoryDetail(item.id)}>
                            工作台详情
                          </button>
                        ) : null}
                        <Link className="sf-tag" href={detailHref}>
                          详情页
                        </Link>
                        <button
                          className="sf-tag disabled:opacity-40"
                          disabled={(item.author_display ?? "") === "已注销用户"}
                          title={
                            (item.author_display ?? "") === "已注销用户"
                              ? "无法关注已注销作者"
                              : undefined
                          }
                          onClick={() => followAuthor(item.author_id)}
                        >
                          关注作者
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {feed.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#DCE9FF] bg-white p-3 text-sm text-[#5B6B8C]">
                  {marketTab === "story" && "暂无已发布故事。先新建故事并发布，再刷新列表。"}
                  {marketTab === "character" && "暂无已发布角色。创建角色卡并发布后在此展示。"}
                  {marketTab === "world" && "暂无已发布世界。创建世界卡并发布后在此展示。"}
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
                        工作台
                      </button>
                    )}
                    {typeof item.payload.character_id === "string" && (
                      <Link className="ml-2 sf-tag" href={`/characters/${String(item.payload.character_id)}`}>
                        详情
                      </Link>
                    )}
                    {typeof item.payload.world_id === "string" && (
                      <Link className="ml-2 sf-tag" href={`/worlds/${String(item.payload.world_id)}`}>
                        详情
                      </Link>
                    )}
                  </li>
                ))}
                {notifications.length === 0 && <li>暂无通知</li>}
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[#DCE9FF] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#1F2A44]">我的收藏</p>
                <button className="sf-tag" onClick={() => void loadMyFavorites()}>
                  刷新
                </button>
              </div>
              <ul className="mt-2 space-y-2 text-xs">
                {myFavorites.map((row) => {
                  const href =
                    row.target_type === "character"
                      ? `/characters/${row.target_id}`
                      : row.target_type === "world"
                        ? `/worlds/${row.target_id}`
                        : `/stories/${row.target_id}`;
                  return (
                    <li
                      key={row.favorite_row_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FBFF] p-2"
                    >
                      <div>
                        <span className="text-[10px] uppercase text-[#5B9DFF]">{row.target_type}</span>
                        <p className="font-medium text-[#1F2A44]">{row.title ?? row.target_id}</p>
                      </div>
                      <Link className="sf-tag" href={href}>
                        打开
                      </Link>
                    </li>
                  );
                })}
                {myFavorites.length === 0 && (
                  <li className="text-[#5B6B8C]">暂无收藏</li>
                )}
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="sf-tag"
                        onClick={() => setStoryId(item.id)}
                        title="设为当前故事"
                      >
                        设为当前
                      </button>
                      <Link className="sf-tag" href={`/stories/${item.id}/edit`}>
                        大纲
                      </Link>
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
                            await loadFeed(feedSort, marketTab);
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#1F2A44]">我的角色卡</p>
                <div className="flex gap-2">
                  <button className="sf-tag" onClick={loadMyCharacters}>
                    刷新
                  </button>
                  <button className="sf-tag" onClick={createSampleCharacter}>
                    快速创建
                  </button>
                </div>
              </div>
              <ul className="mt-2 space-y-2 text-xs text-[#5B6B8C]">
                {myCharacters.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FBFF] p-2"
                  >
                    <div>
                      <p className="font-medium text-[#1F2A44]">{item.name}</p>
                      <p>状态：{item.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link className="sf-tag" href={`/characters/${item.id}`}>
                        详情
                      </Link>
                      {item.status === "published" ? (
                        <button
                          className="sf-tag"
                          onClick={async () => {
                            const res = await fetch(`/api/characters/${item.id}/unpublish`, {
                              method: "POST",
                            });
                            const json = await res.json();
                            pushLog(json.msg ?? "已下架");
                            await loadMyCharacters();
                            await loadFeed(feedSort, marketTab);
                          }}
                        >
                          下架
                        </button>
                      ) : (
                        <button
                          className="sf-tag"
                          onClick={async () => {
                            const res = await fetch(`/api/characters/${item.id}/publish`, {
                              method: "POST",
                            });
                            const json = await res.json();
                            pushLog(json.msg ?? "发布");
                            await loadMyCharacters();
                            await loadFeed(feedSort, marketTab);
                          }}
                        >
                          发布
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {myCharacters.length === 0 && <li>暂无角色卡</li>}
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-[#DCE9FF] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#1F2A44]">我的世界卡</p>
                <div className="flex gap-2">
                  <button className="sf-tag" onClick={loadMyWorlds}>
                    刷新
                  </button>
                  <button className="sf-tag" onClick={createSampleWorld}>
                    快速创建
                  </button>
                </div>
              </div>
              <ul className="mt-2 space-y-2 text-xs text-[#5B6B8C]">
                {myWorlds.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FBFF] p-2"
                  >
                    <div>
                      <p className="font-medium text-[#1F2A44]">{item.name}</p>
                      <p>状态：{item.status}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link className="sf-tag" href={`/worlds/${item.id}`}>
                        详情
                      </Link>
                      {item.status === "published" ? (
                        <button
                          className="sf-tag"
                          onClick={async () => {
                            const res = await fetch(`/api/worlds/${item.id}/unpublish`, {
                              method: "POST",
                            });
                            const json = await res.json();
                            pushLog(json.msg ?? "已下架");
                            await loadMyWorlds();
                            await loadFeed(feedSort, marketTab);
                          }}
                        >
                          下架
                        </button>
                      ) : (
                        <button
                          className="sf-tag"
                          onClick={async () => {
                            const res = await fetch(`/api/worlds/${item.id}/publish`, {
                              method: "POST",
                            });
                            const json = await res.json();
                            pushLog(json.msg ?? "发布");
                            await loadMyWorlds();
                            await loadFeed(feedSort, marketTab);
                          }}
                        >
                          发布
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {myWorlds.length === 0 && <li>暂无世界卡</li>}
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
                  <p className="mt-1">
                    作者：
                    {selectedStoryDetail.author_display ?? selectedStoryDetail.author_id}
                  </p>
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
                    <div className="mt-2 flex flex-wrap items-center gap-2">
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
                      <input
                        className="sf-input w-36 text-xs"
                        placeholder="快照备注"
                        value={snapshotLabel}
                        onChange={(e) => setSnapshotLabel(e.target.value)}
                      />
                      <button className="sf-tag" type="button" onClick={() => createSessionSnapshot()}>
                        创建快照
                      </button>
                    </div>
                  )}
                  {selectedSessionForHistory && sessionSnapshots.length > 0 && (
                    <div className="mt-3 border-t border-[#DCE9FF] pt-2">
                      <p className="text-xs font-medium text-[#1F2A44]">检查点（恢复快照将删除其后消息）</p>
                      <ul className="mt-1 space-y-1">
                        {sessionSnapshots.map((sn) => (
                          <li
                            key={sn.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded bg-[#F0F6FF] px-2 py-1 text-xs text-[#5B6B8C]"
                          >
                            <span>
                              {sn.label ? (
                                <span className="font-medium text-[#1F2A44]">{sn.label}</span>
                              ) : (
                                <span className="text-[#5B6B8C]">（无备注）</span>
                              )}{" "}
                              · {new Date(sn.created_at).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              className="sf-tag text-[11px]"
                              onClick={() => restoreSessionSnapshot(sn.id)}
                            >
                              恢复
                            </button>
                          </li>
                        ))}
                      </ul>
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
    </div>
  );
}
