"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewWorldPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [settingNotes, setSettingNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("世界名称不能为空");
      return;
    }
    setBusy(true);
    setErr("");
    const tags = tagsInput
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);
    const res = await fetch("/api/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), summary, setting_notes: settingNotes, tags }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.code === 200) {
      router.push(`/worlds/${json.data.id}`);
    } else {
      setErr(json.msg ?? "创建失败");
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">创作</p>
        <h1 className="text-xl font-semibold text-[#1F2A44]">创建世界卡</h1>
        <p className="mt-1 text-sm text-[#5B6B8C]">
          创建独立的世界卡，定义世界观设定，可直接对话探索，也可引入到故事项目中。
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <form onSubmit={handleSubmit} className="sf-card space-y-5 p-6">
        {/* 名称 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">
            世界名称 <span className="text-red-500">*</span>
          </label>
          <input
            className="sf-input w-full"
            placeholder="如：赛博朋克夜之城"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </div>

        {/* 简介 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">简介</label>
          <textarea
            className="sf-input w-full min-h-20 resize-y"
            placeholder="简要描述世界的核心概念、时代背景..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={1000}
          />
        </div>

        {/* 设定笔记 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">世界设定</label>
          <textarea
            className="sf-input w-full min-h-36 resize-y"
            placeholder="描述世界的核心规则、社会体系、科技水平、地理环境、历史大事件等..."
            value={settingNotes}
            onChange={(e) => setSettingNotes(e.target.value)}
            maxLength={8000}
          />
        </div>

        {/* 标签 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">标签</label>
          <input
            className="sf-input w-full"
            placeholder="用逗号或空格分隔，如：赛博朋克, 反乌托邦, 未来"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
          <p className="mt-1 text-xs text-[#5B6B8C]">最多 10 个标签，每个最长 30 字</p>
        </div>

        {/* 提交 */}
        <div className="flex gap-3 pt-2">
          <button type="submit" className="sf-btn-primary" disabled={busy}>
            {busy ? "创建中..." : "创建世界卡"}
          </button>
          <button
            type="button"
            className="sf-btn-secondary"
            onClick={() => router.back()}
          >
            取消
          </button>
        </div>
      </form>
    </main>
  );
}
