"use client";

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
  feed_kind?: "story" | "character" | "world";
};

const getCoverGradient = (kind: string, index: number) => {
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  ];
  return gradients[index % gradients.length];
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
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedSort, setFeedSort] = useState("recommended");
  const [marketTab, setMarketTab] = useState<"story" | "character" | "world">("story");

  async function loadFeed(sort = feedSort, tab = marketTab) {
    const kind = tab === "story" ? "story" : tab === "character" ? "character" : "world";
    const res = await fetch(`/api/feed?sort=${sort}&kind=${kind}`);
    const json = await res.json();
    setFeed(json.data.items ?? []);
    setFeedSort(sort);
    setMarketTab(tab);
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
    const res = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author_id: authorId }),
    });
    await res.json();
    await loadFeed(feedSort, marketTab);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFeed("recommended", "story");
  }, []);

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="section-header flex-col md:flex-row items-start md:items-center gap-4">
        <div>
          <h2 className="section-title">发现精彩创作</h2>
          <p className="section-subtitle">探索故事、角色与世界，获取创作灵感</p>
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex flex-wrap gap-3">
        <button
          className={`tab-button ${marketTab === "story" ? "active" : ""}`}
          onClick={() => loadFeed(feedSort, "story")}
        >
          📖 故事
        </button>
        <button
          className={`tab-button ${marketTab === "character" ? "active" : ""}`}
          onClick={() => loadFeed(feedSort, "character")}
        >
          👤 角色
        </button>
        <button
          className={`tab-button ${marketTab === "world" ? "active" : ""}`}
          onClick={() => loadFeed(feedSort, "world")}
        >
          🌍 世界
        </button>
        <div className="ml-auto flex gap-2">
          <button
            className={`sort-button ${feedSort === "latest" ? "active" : ""}`}
            onClick={() => loadFeed("latest", marketTab)}
          >
            最新
          </button>
          <button
            className={`sort-button ${feedSort === "updated" ? "active" : ""}`}
            onClick={() => loadFeed("updated", marketTab)}
          >
            更新
          </button>
          <button
            className={`sort-button ${feedSort === "recommended" ? "active" : ""}`}
            onClick={() => loadFeed("recommended", marketTab)}
          >
            推荐
          </button>
        </div>
      </div>

      {/* 卡片网格 */}
      {feed.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {feed.map((item, index) => {
            const kind = item.feed_kind ?? "story";
            const detailHref =
              kind === "character"
                ? `/characters/${item.id}`
                : kind === "world"
                  ? `/worlds/${item.id}`
                  : `/stories/${item.id}`;
            return (
              <article key={`${kind}-${item.id}`} className="market-card">
                <div
                  className="market-card-cover"
                  style={{ background: getCoverGradient(kind, index) }}
                >
                  <div className="market-card-placeholder">
                    {getPlaceholderIcon(kind)}
                  </div>
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
                  <div className="market-card-actions">
                    <button className="sf-tag" onClick={() => likeFeedItem(item.id, kind)}>
                      点赞
                    </button>
                    <button className="sf-tag" onClick={() => favoriteFeedItem(item.id, kind)}>
                      收藏
                    </button>
                    <Link className="sf-tag" href={detailHref}>
                      查看
                    </Link>
                    <button
                      className="sf-tag disabled:opacity-40"
                      disabled={(item.author_display || "") === "已注销用户"}
                      onClick={() => followAuthor(item.author_id)}
                    >
                      关注
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="sf-card p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-[#5b6b8c] text-lg">
            {marketTab === "story" && "暂无已发布故事。先新建故事并发布，再刷新列表。"}
            {marketTab === "character" && "暂无已发布角色。创建角色卡并发布后在此展示。"}
            {marketTab === "world" && "暂无已发布世界。创建世界卡并发布后在此展示。"}
          </p>
        </div>
      )}
    </div>
  );
}
