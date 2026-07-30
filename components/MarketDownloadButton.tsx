"use client";

import { App } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { currentPathForLogin, loginHref } from "@/lib/login-redirect";

type WorkType = "story" | "character" | "world";

type MarketDownloadButtonProps = {
  workType: WorkType;
  workId: string;
  /** 已登录用户 id；为空则点击时跳转登录 */
  currentUserId?: string;
  className?: string;
};

export default function MarketDownloadButton({
  workType,
  workId,
  currentUserId,
  className = "",
}: MarketDownloadButtonProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function ensureLogin(): Promise<boolean> {
    if (currentUserId) return true;
    const res = await fetch("/api/profile");
    if (res.ok) {
      const json = await res.json();
      if (json.code === 200 && json.data?.id) return true;
    }
    router.push(loginHref(currentPathForLogin()));
    return false;
  }

  async function onDownload() {
    if (!(await ensureLogin())) return;
    setBusy(true);
    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_type: workType, work_id: workId }),
      });
      const json = await res.json();
      if (json.code !== 200 || !json.data?.local_work_id) {
        message.error(json.msg ?? "下载失败");
        return;
      }
      message.success(json.msg ?? "下载成功");
      const base =
        workType === "character" ? "characters" : workType === "world" ? "worlds" : "stories";
      router.push(`/${base}/${json.data.local_work_id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <span
        className="pointer-events-none absolute -right-1 -top-2 z-10 rounded-full bg-[#E8F8EF] px-2 py-0.5 text-[10px] font-semibold leading-none text-[#27824B] ring-1 ring-[#9BD3B0]"
        aria-hidden
      >
        免费
      </span>
      <button
        type="button"
        className="sf-btn-primary disabled:opacity-60"
        disabled={busy}
        onClick={() => void onDownload()}
      >
        {busy ? "下载中…" : "下载"}
      </button>
    </div>
  );
}
