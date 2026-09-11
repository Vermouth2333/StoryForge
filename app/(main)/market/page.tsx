"use client";

import { App } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Search, X, Sparkles, TrendingUp, Clock, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Heart, IconBadge, Inbox, Star, VenetianMask, WorkTypeIcon } from "@/components/icons";
import { currentPathForLogin, loginHref } from "@/lib/login-redirect";

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
      "linear-gradient(145deg, var(--story-bg) 0%, var(--primary-soft) 50%, var(--primary-muted) 100%)",
      "linear-gradient(160deg, var(--primary-soft) 0%, var(--story-bg) 100%)",
    ],
    character: [
      "linear-gradient(145deg, var(--character-bg) 0%, #ede9fe 55%, #ddd6fe 100%)",
      "linear-gradient(160deg, #f5f3ff 0%, var(--character-bg) 100%)",
    ],
    world: [
      "linear-gradient(145deg, var(--world-bg) 0%, #cffafe 55%, #a5f3fc 100%)",
      "linear-gradient(160deg, #ecfeff 0%, var(--world-bg) 100%)",
    ],
  };
  const list = byKind[kind] ?? byKind.story;
  return list[index % list.length];
};

export default function MarketPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedSort, setFeedSort] = useState("recommended");
  const [marketTab, setMarketTab] = useState<"story" | "character" | "world">("story");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [meId, setMeId] = useState<string | null>(null);

  async function requireLogin(): Promise<boolean> {
    if (meId) return true;
    const res = await fetch("/api/profile");
    if (res.ok) {
      const json = await res.json();
      if (json.code === 200 && json.data?.id) {
        setMeId(String(json.data.id));
        return true;
      }
    }
    router.push(loginHref(currentPathForLogin()));
    return false;
  }

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
    if (!(await requireLogin())) return;
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
    if (!(await requireLogin())) return;
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
    if (!(await requireLogin())) return;
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

  const [isFilterSticky, setIsFilterSticky] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = filterRef.current;
    if (!el) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => setIsFilterSticky(!entry.isIntersecting),
      { threshold: 1, rootMargin: "-1px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const featured = feed.slice(0, 3);
  const rest = feed.slice(3);

  return (
    <div className="sf-market-page sf-page-enter">
      {/* Hero section with search */}
      <section className="sf-market-hero sf-reveal">
        <div className="sf-market-hero-content">
          <h1 className="sf-market-hero-title">发现精彩创作</h1>
          <p className="sf-market-hero-subtitle">
            探索故事、角色与世界，获取创作灵感
          </p>
        </div>
        
        <div className="sf-market-search">
          <div className="sf-search-input-wrapper">
            <Search className="sf-search-icon" />
            <input
              className="sf-search-input"
              placeholder="搜索故事、角色、世界..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
            {searchInput && (
              <button
                type="button"
                className="sf-search-clear sf-focus-ring"
                onClick={() => setSearchInput("")}
                aria-label="清空搜索"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button type="button" className="sf-btn-primary sf-hover-glow shrink-0" onClick={handleSearch}>
            搜索
          </button>
        </div>

        {searchQuery && (
          <div className="sf-search-active">
            <span>搜索结果：「{searchQuery}」</span>
            <button
              type="button"
              className="sf-search-clear-tag sf-focus-ring"
              onClick={() => { setSearchInput(""); void loadFeed(feedSort, marketTab, ""); }}
            >
              清除搜索
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Sticky filter bar */}
      <div ref={filterRef} className="sf-filter-sentinel" aria-hidden />
      <section className={`sf-market-filters ${isFilterSticky ? 'sf-market-filters--sticky' : ''}`}>
        <div className="sf-filter-tabs">
          <button
            className={`sf-filter-tab sf-focus-ring ${marketTab === "story" ? "sf-filter-tab--active" : ""}`}
            onClick={() => handleTabChange("story")}
          >
            <WorkTypeIcon type="story" size="sm" />
            <span>故事</span>
          </button>
          <button
            className={`sf-filter-tab sf-focus-ring ${marketTab === "character" ? "sf-filter-tab--active" : ""}`}
            onClick={() => handleTabChange("character")}
          >
            <WorkTypeIcon type="character" size="sm" />
            <span>角色</span>
          </button>
          <button
            className={`sf-filter-tab sf-focus-ring ${marketTab === "world" ? "sf-filter-tab--active" : ""}`}
            onClick={() => handleTabChange("world")}
          >
            <WorkTypeIcon type="world" size="sm" />
            <span>世界</span>
          </button>
        </div>
        
        <div className="sf-sort-buttons">
          <button
            className={`sf-sort-btn sf-focus-ring ${feedSort === "recommended" ? "sf-sort-btn--active" : ""}`}
            onClick={() => handleSortChange("recommended")}
            title="推荐"
          >
            <Sparkles className="w-4 h-4" />
            <span className="sf-sort-label">推荐</span>
          </button>
          <button
            className={`sf-sort-btn sf-focus-ring ${feedSort === "latest" ? "sf-sort-btn--active" : ""}`}
            onClick={() => handleSortChange("latest")}
            title="最新"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="sf-sort-label">最新</span>
          </button>
          <button
            className={`sf-sort-btn sf-focus-ring ${feedSort === "updated" ? "sf-sort-btn--active" : ""}`}
            onClick={() => handleSortChange("updated")}
            title="更新"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="sf-sort-label">更新</span>
          </button>
        </div>
      </section>

      {/* Featured section - first 3 items */}
      {featured.length > 0 && !searchQuery && (
        <section className="sf-market-featured sf-reveal" style={{ animationDelay: "0.1s" }}>
          <div className="sf-featured-header">
            <h2 className="sf-featured-title">
              <Sparkles className="w-5 h-5 text-[var(--primary)]" />
              精选{marketTab === "story" ? "故事" : marketTab === "character" ? "角色" : "世界"}
            </h2>
          </div>
          <div className="sf-featured-grid sf-stagger">
            {featured.map((item, index) => (
              <FeaturedCard
                key={`featured-${item.feed_kind}-${item.id}`}
                item={item}
                index={index}
                onLike={() => likeFeedItem(item.id, item.feed_kind)}
                onFavorite={() => favoriteFeedItem(item.id, item.feed_kind)}
                onFollow={() => followAuthor(item.author_id)}
                meId={meId}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main grid */}
      {(searchQuery ? feed : rest).length > 0 ? (
        <section className="sf-market-grid-section sf-reveal" style={{ animationDelay: "0.15s" }}>
          {!searchQuery && rest.length > 0 && (
            <div className="sf-grid-header">
              <h2 className="sf-grid-title">全部{marketTab === "story" ? "故事" : marketTab === "character" ? "角色" : "世界"}</h2>
              <span className="sf-grid-count">{feed.length} 项</span>
            </div>
          )}
          <div className="sf-market-grid sf-stagger">
            {(searchQuery ? feed : rest).map((item, index) => {
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
                  className="market-card sf-lift block cursor-pointer"
                >
                  <div
                    className={`market-card-cover${coverSrc ? " market-card-cover--with-image" : ""}`}
                    style={coverSrc ? undefined : { background: getCoverGradient(kind, index) }}
                  >
                    {coverSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverSrc} alt={`${item.title} 封面`} loading="lazy" />
                    ) : (
                      <div className="market-card-placeholder text-[var(--primary)]">
                        <WorkTypeIcon type={kind} size="xl" />
                      </div>
                    )}
                  </div>
                  <div className="market-card-content">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`market-card-kind ${kind}`}>
                        {kind === "story" ? "故事" : kind === "character" ? "角色" : "世界"}
                      </span>
                      <span className="market-card-free">免费</span>
                    </div>
                    <h3 className="market-card-title">{item.title}</h3>
                    <p className="market-card-summary">
                      {item.summary || "支持点赞、关注、通知与基础推荐排序。"}
                    </p>
                    <div className="market-card-meta">
                      <span className="market-card-author">
                        <IconBadge icon={VenetianMask} tone="character" size="sm" />
                        {item.author_display || item.author_id}
                      </span>
                      <div className="market-card-stats">
                        <span className="market-card-stat">
                          <IconBadge icon={Heart} tone="danger" size="sm" />
                          {item.like_count}
                        </span>
                        <span className="market-card-stat">
                          <IconBadge icon={Star} tone="star" size="sm" />
                          {Number(item.favorite_count ?? 0)}
                        </span>
                      </div>
                    </div>
                    <div className="market-card-actions" onClick={(e) => e.preventDefault()}>
                      <button className="sf-tag sf-press" onClick={() => likeFeedItem(item.id, kind)}>
                        点赞
                      </button>
                      <button className="sf-tag sf-press" onClick={() => favoriteFeedItem(item.id, kind)}>
                        收藏
                      </button>
                      {!(meId && item.author_id === meId) && (
                        <button
                          className="sf-tag sf-press disabled:opacity-40"
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
        </section>
      ) : (
        <section className="sf-market-empty sf-reveal">
          <EmptyState
            icon={Inbox}
            tone="empty"
            title="暂无内容"
            description={
              searchQuery
                ? `没有找到与「${searchQuery}」相关的${marketTab === "story" ? "故事" : marketTab === "character" ? "角色" : "世界"}，换个关键词试试吧。`
                : marketTab === "story"
                  ? "暂无已发布故事。先新建故事并发布，再刷新列表。"
                  : marketTab === "character"
                    ? "暂无已发布角色。创建角色卡并发布后在此展示。"
                    : "暂无已发布世界。创建世界卡并发布后在此展示。"
            }
          />
        </section>
      )}
    </div>
  );
}

function FeaturedCard({
  item,
  index,
  onLike,
  onFavorite,
  onFollow,
  meId,
}: {
  item: FeedItem;
  index: number;
  onLike: () => void;
  onFavorite: () => void;
  onFollow: () => void;
  meId: string | null;
}) {
  const kind = item.feed_kind ?? "story";
  const coverSrc = item.cover_url || item.cover_thumbnail_url;
  const detailHref =
    kind === "character"
      ? `/characters/${item.id}?from=market`
      : kind === "world"
        ? `/worlds/${item.id}?from=market`
        : `/stories/${item.id}?from=market`;

  return (
    <Link href={detailHref} className="sf-featured-card sf-lift block">
      <div
        className="sf-featured-cover"
        style={coverSrc ? undefined : { background: getCoverGradient(kind, index) }}
      >
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt={item.title} loading="lazy" />
        ) : (
          <div className="sf-featured-placeholder">
            <WorkTypeIcon type={kind} size="xl" />
          </div>
        )}
        <div className="sf-featured-overlay">
          <span className={`market-card-kind ${kind}`}>
            {kind === "story" ? "故事" : kind === "character" ? "角色" : "世界"}
          </span>
        </div>
      </div>
      <div className="sf-featured-content">
        <h3 className="sf-featured-card-title">{item.title}</h3>
        <p className="sf-featured-summary">{item.summary || "精彩内容等你发现"}</p>
        <div className="sf-featured-meta">
          <span className="sf-featured-author">
            <IconBadge icon={VenetianMask} tone="character" size="sm" />
            {item.author_display || "匿名"}
          </span>
          <div className="sf-featured-stats">
            <span><Heart className="w-3.5 h-3.5" /> {item.like_count}</span>
            <span><Star className="w-3.5 h-3.5" /> {item.favorite_count ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
