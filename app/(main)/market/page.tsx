"use client";

import { App } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";

type FeedItem = {
  id: string;
  title: string;
  summary: string;
  like_count: number;
  favorite_count?: number;
  author_id: string;
  author_display?: string;
  cover_url?: string | null;
  cover_thumbnail_url?: string | null;
  feed_kind?: "story" | "character" | "world";
};

const getCoverGradient = (kind: string, index: number) => {
  const byKind: Record<string, string[]> = {
    story: [
      "linear-gradient(145deg, #7FB4FF 0%, #5B9DFF 50%, #3F86F5 100%)",
      "linear-gradient(160deg, #A8CBFF 0%, #5B9DFF 100%)",
    ],
    character: [
      "linear-gradient(145deg, #8EC8FF 0%, #4A9FE8 55%, #2F7EC4 100%)",
      "linear-gradient(160deg, #B7DBFF 0%, #5BB8FF 100%)",
    ],
    world: [
      "linear-gradient(145deg, #79C2F0 0%, #3F9AD4 55%, #2A6FA8 100%)",
      "linear-gradient(160deg, #A6D8F5 0%, #4AA8E8 100%)",
    ],
  };
  const list = byKind[kind] ?? byKind.story;
  return list[index % list.length];
};

const getPlaceholderIcon = (kind: string) => {
  switch (kind) {
    case "character":
      return "👤";
    case "world":
      return "🌍";
    default:
      return "📖";
  }
};

export default function MarketPage() {
  const { message } = App.useApp();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedSort, setFeedSort] = useState("recommended");
  const [marketTab, setMarketTab] = useState<"story" | "character" | "world">("story");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [meId, setMeId] = useState<string | null>(null);

  async function loadFeed(sort = feedSort, tab = marketTab, search = searchQuery) {
    const kind = tab === "story" ? "story" : tab === "character" ? "character" : "world";
    const params = new URLSearchParams({ sort, kind });
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/feed?${params.toString()}`);
    const json = await res.json();
    setFeed(json.data.items ?? []);
    setFeedSort(sort);
    setMarketTab(tab);
    setSearchQuery(search);
  }

  async function likeFeedItem(targetId: string, kind: FeedItem["feed_kind"]) {
    const target_type = kind ?? "story";
    const res = await fetch("/api/likes/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type, target_id: targetId }),
    });
    await res.json();
    await loadFeed(feedSort, marketTab);
  }

  async function favoriteFeedItem(targetId: string, kind: FeedItem["feed_kind"]) {
    const target_type = kind ?? "story";
    const res = await fetch("/api/favorites/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type, target_id: targetId }),
    });
    await res.json();
    await loadFeed(feedSort, marketTab);
  }

  async function followAuthor(authorId: string) {
    if (meId && authorId === meId) {
      message.warning("不能关注自己");
      return;
    }
    const res = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: authorId }),
    });
    const json = await res.json();
    if (json.code !== 200) {
      message.error(json.msg ?? "关注失败");
      return;
    }
    message.success(json.msg ?? "操作成功");
    await loadFeed(feedSort, marketTab);
  }

  function handleSearch() {
    void loadFeed(feedSort, marketTab, searchInput);
  }

  function handleTabChange(tab: "story" | "character" | "world") {
    void loadFeed(feedSort, tab, searchQuery);
  }

  function handleSortChange(sort: string) {
    void loadFeed(sort, marketTab, searchQuery);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFeed("recommended", "story");
    void (async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const json = await res.json();
      if (json.code === 200 && json.data?.id) setMeId(String(json.data.id));
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div className="sf-hero-banner sf-reveal relative z-0">
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5B9DFF]">StoryForge Market</p>
          <h2 className="section-title mt-2">发现精彩创作</h2>
          <p className="section-subtitle max-w-xl">
            探索故事、角色与世界，获取创作灵感。点开作品即可体验与评价。
          </p>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="sf-card p-4 sf-reveal" style={{ animationDelay: "0.08s" }}>
        <div className="flex gap-2">
          <input
            className="sf-input flex-1"
            placeholder="搜索故事、角色、世界..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          />
          <button type="button" className="sf-btn-primary shrink-0" onClick={handleSearch}>
            搜索
          </button>
          {searchQuery && (
            <button
              type="button"
              className="sf-btn-secondary shrink-0"
              onClick={() => { setSearchInput(""); void loadFeed(feedSort, marketTab, ""); }}
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex flex-wrap gap-3">
        <button
          className={`tab-button ${marketTab === "story" ? "active" : ""}`}
          onClick={() => handleTabChange("story")}
        >
          📖 故事
        </button>
        <button
          className={`tab-button ${marketTab === "character" ? "active" : ""}`}
          onClick={() => handleTabChange("character")}
        >
          👤 角色
        </button>
        <button
          className={`tab-button ${marketTab === "world" ? "active" : ""}`}
          onClick={() => handleTabChange("world")}
        >
          🌍 世界
        </button>
        <div className="ml-auto flex gap-2">
          <button
            className={`sort-button ${feedSort === "latest" ? "active" : ""}`}
            onClick={() => handleSortChange("latest")}
          >
            最新
          </button>
          <button
            className={`sort-button ${feedSort === "updated" ? "active" : ""}`}
            onClick={() => handleSortChange("updated")}
          >
            更新
          </button>
          <button
            className={`sort-button ${feedSort === "recommended" ? "active" : ""}`}
            onClick={() => handleSortChange("recommended")}
          >
            推荐
          </button>
        </div>
      </div>

      {/* 卡片网格 */}
      {feed.length > 0 ? (
        <div className="sf-stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {feed.map((item, index) => {
            const kind = item.feed_kind ?? "story";
            const coverSrc = item.cover_url || item.cover_thumbnail_url;
            const detailHref =
              kind === "character"
                ? `/characters/${item.id}?from=market`
                : kind === "world"
                  ? `/worlds/${item.id}?from=market`
                  : `/stories/${item.id}?from=market`;
            return (
              <Link
                key={`${kind}-${item.id}`}
                href={detailHref}
                className="market-card block cursor-pointer transition-shadow hover:shadow-lg"
              >
                <div
                  className={`market-card-cover${coverSrc ? " market-card-cover--with-image" : ""}`}
                  style={coverSrc ? undefined : { background: getCoverGradient(kind, index) }}
                >
                  {coverSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverSrc} alt={`${item.title} 封面`} loading="lazy" />
                  ) : (
                    <div className="market-card-placeholder">
                      {getPlaceholderIcon(kind)}
                    </div>
                  )}
                </div>
                <div className="market-card-content">
                  <span className={`market-card-kind ${kind}`}>
                    {kind === "story" ? "故事" : kind === "character" ? "角色" : "世界"}
                  </span>
                  <h3 className="market-card-title">{item.title}</h3>
                  <p className="market-card-summary">
                    {item.summary || "支持点赞、关注、通知与基础推荐排序。"}
                  </p>
                  <div className="market-card-meta">
                    <span className="market-card-author">
                      <span>👤</span>
                      {item.author_display || item.author_id}
                    </span>
                    <div className="market-card-stats">
                      <span>❤️ {item.like_count}</span>
                      <span>⭐ {Number(item.favorite_count ?? 0)}</span>
                    </div>
                  </div>
                  <div className="market-card-actions" onClick={(e) => e.preventDefault()}>
                    <button className="sf-tag" onClick={() => likeFeedItem(item.id, kind)}>
                      点赞
                    </button>
                    <button className="sf-tag" onClick={() => favoriteFeedItem(item.id, kind)}>
                      收藏
                    </button>
                    {!(meId && item.author_id === meId) && (
                      <button
                        className="sf-tag disabled:opacity-40"
                        disabled={(item.author_display || "") === "已注销用户"}
                        onClick={() => followAuthor(item.author_id)}
                      >
                        关注
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="sf-card p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-[#5b6b8c] text-lg">
            {searchQuery
              ? `没有找到与「${searchQuery}」相关的${marketTab === "story" ? "故事" : marketTab === "character" ? "角色" : "世界"}，换个关键词试试吧。`
              : (
                <>
                  {marketTab === "story" && "暂无已发布故事。先新建故事并发布，再刷新列表。"}
                  {marketTab === "character" && "暂无已发布角色。创建角色卡并发布后在此展示。"}
                  {marketTab === "world" && "暂无已发布世界。创建世界卡并发布后在此展示。"}
                </>
              )}
          </p>
        </div>
      )}
    </div>
  );
}
