"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CoverFileField from "@/components/CoverFileField";
import WorkImportPanel from "@/components/WorkImportPanel";
import { uploadWorkCover } from "@/lib/upload-cover";

export default function NewCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [personality, setPersonality] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("角色名称不能为空");
      return;
    }
    setBusy(true);
    setErr("");
    const tags = tagsInput
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);
    const res = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), summary, personality, tags }),
    });
    const json = await res.json();
    if (json.code === 200) {
      const id = json.data.id as string;
      if (coverFile) {
        const upload = await uploadWorkCover(`/api/characters/${id}/cover`, coverFile);
        if (!upload.ok) {
          setErr(upload.msg ?? "角色已创建，但封面上传失败");
          setBusy(false);
          return;
        }
      }
      router.push(`/characters/${id}`);
    } else {
      setErr(json.msg ?? "创建失败");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-[#5B9DFF]">创作</p>
        <h1 className="text-xl font-semibold text-[#1F2A44]">创建角色卡</h1>
        <p className="mt-1 text-sm text-[#5B6B8C]">
          创建独立的角色卡，可直接对话测试，也可引入到故事项目中。
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <form onSubmit={handleSubmit} className="sf-card space-y-5 p-6">
        <WorkImportPanel
          kind="character"
          onParsed={(data) => {
            setName(data.title);
            setSummary(data.summary);
            setPersonality(data.personality ?? "");
            setTagsInput((data.tags ?? []).join(", "));
          }}
        />
        {/* 名称 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">
            角色名称 <span className="text-red-500">*</span>
          </label>
          <input
            className="sf-input w-full"
            placeholder="如：林晓月"
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
            placeholder="简要描述角色的身份、特征..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={1000}
          />
        </div>

        {/* 性格 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">性格与动机</label>
          <textarea
            className="sf-input w-full min-h-28 resize-y"
            placeholder="描述角色的性格特质、说话风格、核心动机、内心冲突等..."
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            maxLength={8000}
          />
        </div>

        {/* 标签 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">标签</label>
          <input
            className="sf-input w-full"
            placeholder="用逗号或空格分隔，如：剑客, 傲娇, 古风"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
          <p className="mt-1 text-xs text-[#5B6B8C]">最多 10 个标签，每个最长 30 字</p>
        </div>

        <CoverFileField file={coverFile} onChange={setCoverFile} />

        {/* 提交 */}
        <div className="flex gap-3 pt-2">
          <button type="submit" className="sf-btn-primary" disabled={busy}>
            {busy ? "创建中..." : "创建角色卡"}
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
