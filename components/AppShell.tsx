"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function useRouteHash() {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(window.location.hash.replace(/^#/, ""));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return hash;
}

type ProfileLite = {
  id?: string;
  username: string | null;
  avatar_url: string | null;
};

function navClass(active: boolean) {
  return [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors md:justify-center lg:justify-start",
    active
      ? "border-l-[3px] border-[var(--primary)] bg-[var(--primary-soft)] font-medium text-[var(--primary-active)]"
      : "border-l-[3px] border-transparent text-[var(--text-secondary)] hover:bg-[#F8FBFF]",
  ].join(" ");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hash = useRouteHash();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [unread, setUnread] = useState(0);

  const refreshSidebar = useCallback(async () => {
    const [pRes, uRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/notifications/unread-count"),
    ]);
    const pJson = await pRes.json().catch(() => null);
    const uJson = await uRes.json().catch(() => null);
    if (pRes.status === 410 || pJson?.code === 410) {
      setProfile(null);
    } else if (pJson?.code === 200 && pJson.data) {
      setProfile({
        id: String(pJson.data.id),
        username: pJson.data.username ?? null,
        avatar_url: pJson.data.avatar_url ?? null,
      });
    }
    if (uJson?.code === 200 && uJson.data) {
      setUnread(Number(uJson.data.unread ?? 0));
    }
  }, []);

  useEffect(() => {
    void refreshSidebar();
  }, [refreshSidebar]);

  useEffect(() => {
    const onFocus = () => void refreshSidebar();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshSidebar]);

  const onHome = pathname === "/";
  const marketActive = onHome && hash !== "compose";
  const composeActive = onHome && hash === "compose";
  const settingsActive = pathname.startsWith("/settings");

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] md:flex-row">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 md:hidden">
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-drawer"
        >
          菜单
        </button>
        <Link href="/" className="font-semibold text-[var(--foreground)]">
          StoryForge
        </Link>
        <span className="w-10 text-right text-xs text-[var(--text-secondary)]">{unread > 0 ? unread : ""}</span>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="关闭菜单"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="mobile-nav-drawer"
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-[0_6px_18px_rgba(66,133,244,0.12)] transition-transform duration-200 md:relative md:z-0 md:max-w-none md:translate-x-0 md:shadow-none md:transition-none",
          "md:w-16 md:min-w-16 lg:w-60 lg:min-w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-3 md:hidden">
          <span className="font-semibold text-[var(--foreground)]">导航</span>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-secondary)]"
            onClick={() => setMobileOpen(false)}
          >
            关闭
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="border-b border-[var(--border)] px-3 py-4 lg:px-4">
            <Link href="/" className="block font-semibold text-[var(--foreground)]" onClick={closeMobile}>
              <span className="inline md:hidden lg:inline">StoryForge</span>
              <span className="hidden md:inline lg:hidden text-lg">SF</span>
            </Link>
            <p className="mt-1 hidden text-[10px] leading-snug text-[var(--text-secondary)] lg:block">
              MVP / 酒馆对话版本
            </p>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-2 py-4 lg:px-3" aria-label="主导航">
            <Link
              href="/#market"
              title="市场"
              className={navClass(marketActive)}
              onClick={closeMobile}
            >
              <span className="shrink-0 text-lg" aria-hidden>
                📖
              </span>
              <span className="inline md:hidden lg:inline truncate">市场</span>
            </Link>
            <Link
              href="/#compose"
              title="创作"
              className={navClass(composeActive)}
              onClick={closeMobile}
            >
              <span className="shrink-0 text-lg" aria-hidden>
                ✏️
              </span>
              <span className="inline md:hidden lg:inline truncate">创作</span>
            </Link>
            <Link
              href="/settings"
              title="设置"
              className={navClass(settingsActive)}
              onClick={closeMobile}
            >
              <span className="shrink-0 text-lg" aria-hidden>
                ⚙️
              </span>
              <span className="inline md:hidden lg:inline truncate">设置</span>
            </Link>
          </nav>

          <div className="mt-auto space-y-3 border-t border-[var(--border)] px-3 py-4 lg:px-4">
            <div className="rounded-lg bg-[var(--primary-soft)] px-3 py-2 text-center text-xs font-medium text-[var(--primary-active)] lg:text-left">
              <span className="hidden lg:inline">未读通知：</span>
              <span>{unread}</span>
            </div>

            <div className="flex flex-col gap-3 lg:flex-col">
              <div className="flex items-center gap-2">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full border border-[var(--border)] object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)] bg-white text-[10px] text-[var(--text-secondary)]">
                    用户
                  </div>
                )}
                <p className="min-w-0 truncate text-sm font-medium text-[var(--foreground)] md:hidden lg:block">
                  {profile?.username ?? "访客"}
                </p>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <a href="/api/auth/google" className="sf-tag block w-full text-center no-underline">
                  Google 登录
                </a>
                <button
                  type="button"
                  className="sf-tag block w-full"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.reload();
                  }}
                >
                  退出登录
                </button>
              </div>
            </div>

            <Link
              href="/admin/moderation"
              className="block text-center text-[11px] text-[var(--text-secondary)] underline lg:text-left"
              onClick={closeMobile}
            >
              审核台
            </Link>
            <p className="hidden text-[10px] leading-snug text-[var(--text-secondary)] lg:block">
              OAuth 需配置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、JWT_SECRET（≥16 字符）；回调 /api/auth/google/callback。
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
