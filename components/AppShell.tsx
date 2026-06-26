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
  is_admin?: boolean;
};

function navClass(active: boolean) {
  return [
    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-200 md:justify-center lg:justify-start",
    active
      ? "bg-gradient-to-r from-[var(--primary-soft)] to-white font-semibold text-[var(--primary-active)] shadow-sm border border-[var(--border)]"
      : "text-[var(--text-secondary)] hover:bg-[#F8FBFF] hover:border border-[var(--border)] border border-transparent",
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
    if (pRes.status === 401 || pRes.status === 410 || pJson?.code === 401 || pJson?.code === 410) {
      setProfile(null);
    } else if (pJson?.code === 200 && pJson.data) {
      setProfile({
        id: String(pJson.data.id),
        username: pJson.data.username ?? null,
        avatar_url: pJson.data.avatar_url ?? null,
        is_admin: pJson.data.is_admin ?? false,
      });
    }
    if (uJson?.code === 200 && uJson.data) {
      setUnread(Number(uJson.data.unread ?? 0));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const marketActive = pathname.startsWith("/market") || pathname === "/";
  const composeActive = pathname.startsWith("/compose");
  const myActive = pathname.startsWith("/my");
  const historyActive = pathname.startsWith("/history");
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
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_30px_rgba(66,133,244,0.15)] transition-transform duration-300 md:relative md:z-0 md:max-w-none md:translate-x-0 md:shadow-none",
          "md:w-16 md:min-w-16 lg:w-64 lg:min-w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-4 md:hidden bg-gradient-to-r from-[var(--primary-soft)] to-white">
          <span className="font-bold text-[var(--foreground)]">导航</span>
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-white/50 transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            关闭
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="border-b border-[var(--border)] px-4 py-6 lg:px-5 bg-gradient-to-b from-white to-[#F8FBFF]">
            <Link href="/" className="block font-extrabold text-xl text-[var(--foreground)]" onClick={closeMobile}>
              <span className="inline md:hidden lg:inline">StoryForge</span>
              <span className="hidden md:inline lg:hidden text-2xl">SF</span>
            </Link>
            <p className="mt-2 hidden text-xs leading-relaxed text-[var(--text-secondary)] lg:block">
              AI 驱动的交互式小说创作平台
            </p>
          </div>

          <nav className="flex flex-1 flex-col gap-2 px-3 py-5 lg:px-4" aria-label="主导航">
            <Link
              href="/market"
              title="市场"
              className={navClass(marketActive)}
              onClick={closeMobile}
            >
              <span className="shrink-0 text-xl" aria-hidden>
                📖
              </span>
              <span className="inline md:hidden lg:inline truncate font-medium">市场</span>
            </Link>
            {profile && (
              <>
                <Link
                  href="/compose"
                  title="创作"
                  className={navClass(composeActive)}
                  onClick={closeMobile}
                >
                  <span className="shrink-0 text-xl" aria-hidden>
                    ✏️
                  </span>
                  <span className="inline md:hidden lg:inline truncate font-medium">创作</span>
                </Link>
                <Link
                  href="/my"
                  title="我的"
                  className={navClass(myActive)}
                  onClick={closeMobile}
                >
                  <span className="shrink-0 text-xl" aria-hidden>
                    👤
                  </span>
                  <span className="inline md:hidden lg:inline truncate font-medium">我的</span>
                </Link>
                <Link
                  href="/history"
                  title="历史"
                  className={navClass(historyActive)}
                  onClick={closeMobile}
                >
                  <span className="shrink-0 text-xl" aria-hidden>
                    📜
                  </span>
                  <span className="inline md:hidden lg:inline truncate font-medium">历史</span>
                </Link>
                <Link
                  href="/settings"
                  title="设置"
                  className={navClass(settingsActive)}
                  onClick={closeMobile}
                >
                  <span className="shrink-0 text-xl" aria-hidden>
                    ⚙️
                  </span>
                  <span className="inline md:hidden lg:inline truncate font-medium">设置</span>
                </Link>
              </>
            )}
          </nav>

          <div className="mt-auto space-y-4 border-t border-[var(--border)] px-4 py-5 lg:px-5 bg-gradient-to-t from-[#F8FBFF] to-white">
            {profile && (
              <div className="rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
                <span className="hidden lg:inline">未读通知：</span>
                <span className="text-lg">{unread}</span>
              </div>
            )}

            {profile ? (
              <div className="flex flex-col gap-4 lg:flex-col">
                <div className="flex items-center gap-3 bg-[#F8FBFF] rounded-xl p-3">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full border-2 border-[var(--primary-soft)] object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)] bg-white text-xs text-[var(--text-secondary)] font-medium">
                      用户
                    </div>
                  )}
                  <p className="min-w-0 truncate text-sm font-semibold text-[var(--foreground)] md:hidden lg:block">
                    {profile.username ?? "访客"}
                  </p>
                </div>
                <button
                  type="button"
                  className="sf-btn-secondary block w-full text-sm"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.reload();
                  }}
                >
                  退出登录
                </button>
              </div>
            ) : (
              <a href="/api/auth/google" className="sf-btn-primary block w-full text-center no-underline text-sm">
                Google 登录
              </a>
            )}

            {profile?.is_admin && (
              <Link
                href="/admin/moderation"
                className="block text-center text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors lg:text-left"
                onClick={closeMobile}
              >
                审核台
              </Link>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
