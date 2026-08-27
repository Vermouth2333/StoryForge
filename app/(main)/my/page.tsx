"use client";

import { App } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Bell, Globe2, IconBadge, Star, UserRound } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { replayHeaders } from "@/lib/replay-headers";
import { MINE_PAGE_SIZE } from "@/lib/mine-list-query";
import { useWorkConfirm } from "@/hooks/use-work-confirm";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
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
  source_work_id?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
};

type MyCharacterItem = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
  source_work_id?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
};

type MyWorldItem = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
  source_work_id?: string | null;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
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

type PersonaMaskItem = { id: string; name: string; summary: string; updated_at: string };

export default function MyPage() {
  const { message, modal } = App.useApp();
  const { confirmUnpublish, confirmDelete } = useWorkConfirm();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [myStories, setMyStories] = useState<MyStoryItem[]>([]);
  const [myCharacters, setMyCharacters] = useState<MyCharacterItem[]>([]);
  const [myWorlds, setMyWorlds] = useState<MyWorldItem[]>([]);
  const [storyQ, setStoryQ] = useState("");
  const [storyQDebounced, setStoryQDebounced] = useState("");
  const [storyPage, setStoryPage] = useState(1);
  const [storyTotal, setStoryTotal] = useState(0);
  const [characterQ, setCharacterQ] = useState("");
  const [characterQDebounced, setCharacterQDebounced] = useState("");
  const [characterPage, setCharacterPage] = useState(1);
  const [characterTotal, setCharacterTotal] = useState(0);
  const [worldQ, setWorldQ] = useState("");
  const [worldQDebounced, setWorldQDebounced] = useState("");
  const [worldPage, setWorldPage] = useState(1);
  const [worldTotal, setWorldTotal] = useState(0);
  const [myFavorites, setMyFavorites] = useState<FavoriteRow[]>([]);
  const [personaMasks, setPersonaMasks] = useState<PersonaMaskItem[]>([]);

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

  async function loadNotifications() {
    const listRes = await fetch("/api/notifications?page=1&page_size=20");
    const listJson = await listRes.json();
    setNotifications(listJson.data ?? []);
  }

  async function loadMyStories(page = storyPage, q = storyQDebounced) {
    const params = new URLSearchParams({
      mine: "1",
      page: String(page),
      page_size: String(MINE_PAGE_SIZE),
    });
    if (q) params.set("q", q);
    const res = await fetch(`/api/stories?${params}`);
    const json = await res.json();
    const rows = json.data ?? [];
    const total = Number(json.total) || 0;
    if (page > 1 && rows.length === 0 && total > 0) {
      setStoryPage(page - 1);
      return;
    }
    setMyStories(rows);
    setStoryTotal(total);
  }

  async function loadMyCharacters(page = characterPage, q = characterQDebounced) {
    const params = new URLSearchParams({
      mine: "1",
      page: String(page),
      page_size: String(MINE_PAGE_SIZE),
    });
    if (q) params.set("q", q);
    const res = await fetch(`/api/characters?${params}`);
    const json = await res.json();
    const rows = json.data ?? [];
    const total = Number(json.total) || 0;
    if (page > 1 && rows.length === 0 && total > 0) {
      setCharacterPage(page - 1);
      return;
    }
    setMyCharacters(rows);
    setCharacterTotal(total);
  }

  async function loadMyWorlds(page = worldPage, q = worldQDebounced) {
    const params = new URLSearchParams({
      mine: "1",
      page: String(page),
      page_size: String(MINE_PAGE_SIZE),
    });
    if (q) params.set("q", q);
    const res = await fetch(`/api/worlds?${params}`);
    const json = await res.json();
    const rows = json.data ?? [];
    const total = Number(json.total) || 0;
    if (page > 1 && rows.length === 0 && total > 0) {
      setWorldPage(page - 1);
      return;
    }
    setMyWorlds(rows);
    setWorldTotal(total);
  }

  async function loadMyFavorites() {
    const res = await fetch("/api/favorites?limit=50");
    const json = await res.json();
    setMyFavorites(json.data ?? []);
  }

  async function loadPersonaMasks() {
    const res = await fetch("/api/persona-masks");
    const json = await res.json();
    setPersonaMasks(json.code === 200 ? json.data ?? [] : []);
  }

  function deletePersonaMask(mask: PersonaMaskItem) {
    modal.confirm({
      centered: true,
      title: "删除人设面具",
      content: `确定删除「${mask.name}」？`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        const res = await fetch(`/api/persona-masks/${mask.id}`, { method: "DELETE" });
        const json = await res.json();
        if (json.code === 200) {
          message.success("已删除");
          await loadPersonaMasks();
        } else message.error(json.msg ?? "删除失败");
      },
    });
  }

  async function markAllRead() {
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const json = await res.json();
    if (json.code === 200) message.success("已全部标记为已读");
    else message.error(json.msg ?? "操作失败");
    await loadNotifications();
  }

  async function unpublishStory(targetStoryId: string) {
    const story = myStories.find((s) => s.id === targetStoryId);
    confirmUnpublish("story", story?.title ?? "该故事", async () => {
      const res = await fetch(`/api/stories/${targetStoryId}/unpublish`, { method: "POST" });
      const json = await res.json();
      if (json.code === 200) message.success("已下架");
      else message.error(json.msg ?? "下架失败");
      await loadMyStories();
    });
  }

  async function publishStory(story: MyStoryItem) {
    const res = await fetch(`/api/stories/${story.id}/publish`, { method: "POST", headers: replayHeaders() });
    const json = await res.json();
    if (json.code === 200) message.success("发布成功");
    else message.error(json.msg ?? "发布失败");
    await loadMyStories();
  }

  async function publishCharacter(character: MyCharacterItem) {
    const res = await fetch(`/api/characters/${character.id}/publish`, { method: "POST", headers: replayHeaders() });
    const json = await res.json();
    if (json.code === 200) message.success("发布成功");
    else message.error(json.msg ?? "发布失败");
    await loadMyCharacters();
  }

  async function unpublishCharacter(character: MyCharacterItem) {
    confirmUnpublish("character", character.name, async () => {
      const res = await fetch(`/api/characters/${character.id}/unpublish`, { method: "POST" });
      const json = await res.json();
      if (json.code === 200) message.success("已下架");
      else message.error(json.msg ?? "下架失败");
      await loadMyCharacters();
    });
  }

  async function publishWorld(world: MyWorldItem) {
    const res = await fetch(`/api/worlds/${world.id}/publish`, { method: "POST", headers: replayHeaders() });
    const json = await res.json();
    if (json.code === 200) message.success("发布成功");
    else message.error(json.msg ?? "发布失败");
    await loadMyWorlds();
  }

  async function unpublishWorld(world: MyWorldItem) {
    confirmUnpublish("world", world.name, async () => {
      const res = await fetch(`/api/worlds/${world.id}/unpublish`, { method: "POST" });
      const json = await res.json();
      if (json.code === 200) message.success("已下架");
      else message.error(json.msg ?? "下架失败");
      await loadMyWorlds();
    });
  }

  async function deleteStoryItem(story: MyStoryItem) {
    if (story.status === "published") {
      message.warning("请先下架再删除");
      return;
    }
    confirmDelete("story", story.title, async () => {
      const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.code === 200) message.success("已删除");
      else message.error(json.msg ?? "删除失败");
      await loadMyStories();
    });
  }

  async function deleteCharacterItem(character: MyCharacterItem) {
    if (character.status === "published") {
      message.warning("请先下架再删除");
      return;
    }
    confirmDelete("character", character.name, async () => {
      const res = await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.code === 200) message.success("已删除");
      else message.error(json.msg ?? "删除失败");
      await loadMyCharacters();
    });
  }

  async function deleteWorldItem(world: MyWorldItem) {
    if (world.status === "published") {
      message.warning("请先下架再删除");
      return;
    }
    confirmDelete("world", world.name, async () => {
      const res = await fetch(`/api/worlds/${world.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.code === 200) message.success("已删除");
      else message.error(json.msg ?? "删除失败");
      await loadMyWorlds();
    });
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
    await res.json();
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
    await res.json();
    await loadMyWorlds();
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setStoryQDebounced(storyQ);
      setStoryPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [storyQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCharacterQDebounced(characterQ);
      setCharacterPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [characterQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setWorldQDebounced(worldQ);
      setWorldPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [worldQ]);

  useEffect(() => {
    void loadMyStories(storyPage, storyQDebounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyPage, storyQDebounced]);

  useEffect(() => {
    void loadMyCharacters(characterPage, characterQDebounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterPage, characterQDebounced]);

  useEffect(() => {
    void loadMyWorlds(worldPage, worldQDebounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldPage, worldQDebounced]);

  useEffect(() => {
    void loadNotifications();
    void loadMyFavorites();
    void loadPersonaMasks();
  }, []);

  return (
    <div className="space-y-5">
      <PageHero
        title="我的创作空间"
        subtitle="管理你的故事、角色和世界，查看通知与收藏"
      />

      {/* 通知和收藏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 通知中心 */}
        <div className="sf-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#1f2a44] flex items-center gap-2">
              <IconBadge icon={Bell} tone="notify" size="md" /> 通知中心
            </h3>
            <div className="flex gap-2">
              <button className="sf-tag" onClick={loadNotifications}>
                刷新
              </button>
              <button className="sf-tag" onClick={markAllRead}>
                全部已读
              </button>
            </div>
          </div>
          <ul className="space-y-3 max-h-[400px] overflow-y-auto">
            {notifications.map((item) => (
              <li key={item.id} className="rounded-xl bg-[#f8fbff] p-4">
                <p className="text-sm text-[#1f2a44]">
                  <span className="font-semibold text-[#5b9dff]">[{item.type}]</span> {formatNotification(item)}
                </p>
                <div className="mt-2 flex gap-2">
                  {typeof item.payload.story_id === "string" && (
                    <Link className="sf-tag text-xs" href={`/stories/${String(item.payload.story_id)}`}>
                      查看
                    </Link>
                  )}
                  {typeof item.payload.character_id === "string" && (
                    <Link className="sf-tag text-xs" href={`/characters/${String(item.payload.character_id)}`}>
                      查看
                    </Link>
                  )}
                  {typeof item.payload.world_id === "string" && (
                    <Link className="sf-tag text-xs" href={`/worlds/${String(item.payload.world_id)}`}>
                      查看
                    </Link>
                  )}
                </div>
              </li>
            ))}
            {notifications.length === 0 && (
              <li className="text-center py-8 text-[#5b6b8c]">暂无通知</li>
            )}
          </ul>
        </div>

        {/* 我的收藏 */}
        <div className="sf-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#1f2a44] flex items-center gap-2">
              <IconBadge icon={Star} tone="star" size="md" /> 我的收藏
            </h3>
            <button className="sf-tag" onClick={loadMyFavorites}>
              刷新
            </button>
          </div>
          <ul className="space-y-3 max-h-[400px] overflow-y-auto">
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
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#f8fbff] p-4"
                >
                  <div className="min-w-0">
                    <span className="text-xs uppercase tracking-wider text-[#5b9dff] font-semibold">
                      {row.target_type}
                    </span>
                    <p className="font-semibold text-[#1f2a44] truncate mt-1">
                      {row.title || row.target_id}
                    </p>
                  </div>
                  <Link className="sf-tag shrink-0" href={href}>
                    打开
                  </Link>
                </li>
              );
            })}
            {myFavorites.length === 0 && (
              <li className="text-center py-8 text-[#5b6b8c]">暂无收藏</li>
            )}
          </ul>
        </div>
      </div>

      <div className="sf-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1f2a44]">我的人设面具</h3>
          <div className="flex gap-2">
            <button className="sf-tag" onClick={loadPersonaMasks}>刷新</button>
            <Link className="sf-tag" href="/compose?tab=persona">创建</Link>
          </div>
        </div>
        <ul className="space-y-3">
          {personaMasks.map((mask) => (
            <li key={mask.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f8fbff] p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#1f2a44]">{mask.name}</p>
                <p className="mt-1 line-clamp-1 text-xs text-[#5b6b8c]">{mask.summary || "暂无简介"}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link className="sf-tag text-xs" href={`/persona-masks/${mask.id}`}>编辑</Link>
                <button className="sf-tag text-xs !text-[#8B2E2E]" onClick={() => deletePersonaMask(mask)}>删除</button>
              </div>
            </li>
          ))}
          {personaMasks.length === 0 && <li className="py-8 text-center text-[#5b6b8c]">暂无人设面具</li>}
        </ul>
      </div>

      {/* 我的内容 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 我的故事 */}
        <div className="sf-card p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="flex shrink-0 items-center gap-2 text-lg font-bold text-[#1f2a44]">
              <IconBadge icon={BookOpen} tone="story" size="md" /> 我的故事
            </h3>
            <input
              className="sf-input !rounded-lg !px-3 !py-1.5 min-w-0 flex-1 text-sm"
              value={storyQ}
              onChange={(e) => setStoryQ(e.target.value)}
              placeholder="搜索标题或简介"
              aria-label="搜索我的故事"
            />
            <button className="sf-tag shrink-0" onClick={() => void loadMyStories()}>
              刷新
            </button>
          </div>
          <ul className="space-y-3">
            {myStories.map((item) => {
              const coverSrc = item.cover_thumbnail_url || item.cover_url;
              return (
              <li key={item.id} className="relative overflow-hidden rounded-xl bg-[#f8fbff] p-4">
                {item.source_work_id ? (
                  <span className="absolute right-0 top-0 rounded-bl-lg bg-[#EEF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#3F86F5]">
                    市场下载
                  </span>
                ) : null}
                <div className="flex items-start gap-3">
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md bg-[#E8F3FF]">
                    {coverSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-[#8A97B3]">无封面</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1f2a44] truncate">{item.title}</p>
                    <p className="text-xs text-[#5b6b8c] mt-1">状态: {STATUS_LABELS[item.status] ?? item.status}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className="sf-tag text-xs" href={`/stories/${item.id}`}>
                    详情
                  </Link>
                  <Link className="sf-tag text-xs" href={`/stories/${item.id}/edit`}>
                    大纲
                  </Link>
                  {item.status === "published" ? (
                    <button className="sf-tag text-xs" onClick={() => unpublishStory(item.id)}>
                      下架
                    </button>
                  ) : (
                    <>
                      <button className="sf-tag text-xs" onClick={() => publishStory(item)}>
                        发布
                      </button>
                      <button
                        className="sf-tag text-xs !text-[#8B2E2E]"
                        onClick={() => deleteStoryItem(item)}
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </li>
              );
            })}
            {myStories.length === 0 && (
              <li className="text-center py-8 text-[#5b6b8c]">
                {storyQDebounced ? "没有匹配的故事" : "暂无我的故事"}
              </li>
            )}
          </ul>
          <MinePager
            page={storyPage}
            total={storyTotal}
            onPage={setStoryPage}
          />
        </div>

        {/* 我的角色 */}
        <div className="sf-card p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="flex shrink-0 items-center gap-2 text-lg font-bold text-[#1f2a44]">
              <IconBadge icon={UserRound} tone="character" size="md" /> 我的角色
            </h3>
            <input
              className="sf-input !rounded-lg !px-3 !py-1.5 min-w-0 flex-1 text-sm"
              value={characterQ}
              onChange={(e) => setCharacterQ(e.target.value)}
              placeholder="搜索名称或简介"
              aria-label="搜索我的角色"
            />
            <div className="flex shrink-0 gap-2">
              <button className="sf-tag" onClick={() => void loadMyCharacters()}>
                刷新
              </button>
              <Link className="sf-tag" href="/compose?tab=character">创建</Link>
            </div>
          </div>
          <ul className="space-y-3">
            {myCharacters.map((item) => {
              const coverSrc = item.cover_thumbnail_url || item.cover_url;
              return (
              <li key={item.id} className="relative overflow-hidden rounded-xl bg-[#f8fbff] p-4">
                {item.source_work_id ? (
                  <span className="absolute right-0 top-0 rounded-bl-lg bg-[#EEF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#3F86F5]">
                    市场下载
                  </span>
                ) : null}
                <div className="flex items-start gap-3">
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md bg-[#E8F3FF]">
                    {coverSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-[#8A97B3]">无封面</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1f2a44] truncate">{item.name}</p>
                    <p className="text-xs text-[#5b6b8c] mt-1">状态: {STATUS_LABELS[item.status] ?? item.status}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className="sf-tag text-xs" href={`/characters/${item.id}`}>
                    详情
                  </Link>
                  {item.status === "published" ? (
                    <button className="sf-tag text-xs" onClick={() => unpublishCharacter(item)}>
                      下架
                    </button>
                  ) : (
                    <>
                      <button className="sf-tag text-xs" onClick={() => publishCharacter(item)}>
                        发布
                      </button>
                      <button
                        className="sf-tag text-xs !text-[#8B2E2E]"
                        onClick={() => deleteCharacterItem(item)}
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </li>
              );
            })}
            {myCharacters.length === 0 && (
              <li className="text-center py-8 text-[#5b6b8c]">
                {characterQDebounced ? "没有匹配的角色" : "暂无角色卡"}
              </li>
            )}
          </ul>
          <MinePager
            page={characterPage}
            total={characterTotal}
            onPage={setCharacterPage}
          />
        </div>

        {/* 我的世界 */}
        <div className="sf-card p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="flex shrink-0 items-center gap-2 text-lg font-bold text-[#1f2a44]">
              <IconBadge icon={Globe2} tone="world" size="md" /> 我的世界
            </h3>
            <input
              className="sf-input !rounded-lg !px-3 !py-1.5 min-w-0 flex-1 text-sm"
              value={worldQ}
              onChange={(e) => setWorldQ(e.target.value)}
              placeholder="搜索名称或简介"
              aria-label="搜索我的世界"
            />
            <div className="flex shrink-0 gap-2">
              <button className="sf-tag" onClick={() => void loadMyWorlds()}>
                刷新
              </button>
              <Link className="sf-tag" href="/compose?tab=world">创建</Link>
            </div>
          </div>
          <ul className="space-y-3">
            {myWorlds.map((item) => {
              const coverSrc = item.cover_thumbnail_url || item.cover_url;
              return (
              <li key={item.id} className="relative overflow-hidden rounded-xl bg-[#f8fbff] p-4">
                {item.source_work_id ? (
                  <span className="absolute right-0 top-0 rounded-bl-lg bg-[#EEF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#3F86F5]">
                    市场下载
                  </span>
                ) : null}
                <div className="flex items-start gap-3">
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md bg-[#E8F3FF]">
                    {coverSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-[#8A97B3]">无封面</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1f2a44] truncate">{item.name}</p>
                    <p className="text-xs text-[#5b6b8c] mt-1">状态: {STATUS_LABELS[item.status] ?? item.status}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link className="sf-tag text-xs" href={`/worlds/${item.id}`}>
                    详情
                  </Link>
                  {item.status === "published" ? (
                    <button className="sf-tag text-xs" onClick={() => unpublishWorld(item)}>
                      下架
                    </button>
                  ) : (
                    <>
                      <button className="sf-tag text-xs" onClick={() => publishWorld(item)}>
                        发布
                      </button>
                      <button
                        className="sf-tag text-xs !text-[#8B2E2E]"
                        onClick={() => deleteWorldItem(item)}
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </li>
              );
            })}
            {myWorlds.length === 0 && (
              <li className="text-center py-8 text-[#5b6b8c]">
                {worldQDebounced ? "没有匹配的世界" : "暂无世界卡"}
              </li>
            )}
          </ul>
          <MinePager
            page={worldPage}
            total={worldTotal}
            onPage={setWorldPage}
          />
        </div>
      </div>
    </div>
  );
}

function MinePager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / MINE_PAGE_SIZE));
  if (total <= MINE_PAGE_SIZE) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#5B6B8C]">
      <button
        type="button"
        className="sf-tag text-xs disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        上一页
      </button>
      <span>
        {page} / {totalPages}
      </span>
      <button
        type="button"
        className="sf-tag text-xs disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
