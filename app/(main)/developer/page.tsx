"use client";

import { App } from "antd";
import { useEffect, useState } from "react";
import { PageHero } from "@/components/PageHero";

type UserRow = { id: string; username: string | null; credits: number };

export default function DeveloperCreditsPage() {
  const { message } = App.useApp();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadUsers(keyword = q) {
    const params = keyword.trim() ? `?q=${encodeURIComponent(keyword.trim())}` : "";
    const res = await fetch(`/api/developer/users${params}`);
    const json = await res.json().catch(() => null);
    if (res.status === 403 || json?.code === 403) {
      setAllowed(false);
      return;
    }
    if (json?.code === 200) {
      setAllowed(true);
      setUsers(json.data ?? []);
    }
  }

  useEffect(() => {
    void loadUsers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function grant() {
    setBusy(true);
    try {
      const res = await fetch("/api/developer/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, amount, note }),
      });
      const json = await res.json().catch(() => null);
      if (json?.code === 200) {
        message.success(json.msg ?? "已发放");
        setNote("");
        window.dispatchEvent(new Event("sf:profile-updated"));
        await loadUsers();
      } else {
        message.error(json?.msg ?? "发放失败");
      }
    } finally {
      setBusy(false);
    }
  }

  if (allowed === false) {
    return (
      <div className="sf-card p-8 text-center text-sm text-[#5B6B8C]">没有管理员权限</div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHero title="积分管理" subtitle="仅管理员可访问。向指定用户发放积分。" />

      <div className="sf-card space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1F2A44]">用户名</label>
            <input
              className="sf-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="目标用户名"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1F2A44]">积分数量</label>
            <input
              className="sf-input"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1F2A44]">备注</label>
            <input
              className="sf-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="可选"
            />
          </div>
        </div>
        <button type="button" className="sf-btn-primary" disabled={busy || !username.trim()} onClick={() => void grant()}>
          {busy ? "发放中…" : "发放积分"}
        </button>
      </div>

      <div className="sf-card p-6">
        <div className="mb-4 flex gap-2">
          <input
            className="sf-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索用户名"
          />
          <button type="button" className="sf-btn-secondary shrink-0" onClick={() => void loadUsers()}>
            搜索
          </button>
        </div>
        <div className="space-y-2">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-[#DCE9FF] bg-[#F8FBFF] px-4 py-3 text-left text-sm"
              onClick={() => setUsername(u.username ?? "")}
            >
              <span className="font-medium text-[#1F2A44]">{u.username ?? u.id}</span>
              <span className="text-[#5B6B8C]">{u.credits} 积分</span>
            </button>
          ))}
          {users.length === 0 ? <p className="text-sm text-[#8A97B3]">暂无用户</p> : null}
        </div>
      </div>
    </div>
  );
}
