"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { message } from "antd";
import { replayHeaders } from "@/lib/replay-headers";
import { useWorkConfirm } from "@/hooks/use-work-confirm";

export type WorkKind = "story" | "character" | "world";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const KIND_LABEL: Record<WorkKind, string> = {
  story: "故事",
  character: "角色卡",
  world: "世界卡",
};

function parseTagsInput(tagsJson: string): string {
  try {
    const arr = JSON.parse(tagsJson || "[]") as string[];
    return Array.isArray(arr) ? arr.join(", ") : "";
  } catch {
    return "";
  }
}

function buildTagsArray(tagsInput: string): string[] {
  return tagsInput
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}

type AuthorWorkEditorProps = {
  kind: WorkKind;
  id: string;
  status: string;
  /** 故事标题 / 角色名 / 世界名 */
  name: string;
  summary: string;
  tagsJson: string;
  personality?: string;
  settingNotes?: string;
  onUpdated: (data: Record<string, unknown>) => void;
  onStatusChange: (status: string, publishAt?: string | null) => void;
};

export default function AuthorWorkEditor({
  kind,
  id,
  status,
  name: initialName,
  summary: initialSummary,
  tagsJson: initialTagsJson,
  personality: initialPersonality = "",
  settingNotes: initialSettingNotes = "",
  onUpdated,
  onStatusChange,
}: AuthorWorkEditorProps) {
  const [name, setName] = useState(initialName);
  const [summary, setSummary] = useState(initialSummary);
  const [personality, setPersonality] = useState(initialPersonality);
  const [settingNotes, setSettingNotes] = useState(initialSettingNotes);
  const [tagsInput, setTagsInput] = useState(parseTagsInput(initialTagsJson));
  const [busy, setBusy] = useState(false);
  const { confirmUnpublish } = useWorkConfirm();

  useEffect(() => {
    setName(initialName);
    setSummary(initialSummary);
    setPersonality(initialPersonality);
    setSettingNotes(initialSettingNotes);
    setTagsInput(parseTagsInput(initialTagsJson));
  }, [initialName, initialSummary, initialPersonality, initialSettingNotes, initialTagsJson]);

  const apiBase = `/api/${kind === "story" ? "stories" : kind === "character" ? "characters" : "worlds"}/${id}`;
  const nameLabel = kind === "story" ? "标题" : "名称";

  function buildPatchBody() {
    const tags = buildTagsArray(tagsInput);
    if (kind === "story") {
      return { title: name.trim(), summary, tags };
    }
    if (kind === "character") {
      return { name: name.trim(), summary, personality, tags };
    }
    return { name: name.trim(), summary, setting_notes: settingNotes, tags };
  }

  async function saveChanges(syncPublish = false) {
    if (!name.trim()) {
      message.error(`${nameLabel}不能为空`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchBody()),
      });
      const json = await res.json();
      if (json.code !== 200) {
        message.error(json.msg ?? "保存失败");
        return;
      }

      const patch: Record<string, unknown> = {
        ...(kind === "story" ? { title: name.trim() } : { name: name.trim() }),
        summary,
        tags_json: JSON.stringify(buildTagsArray(tagsInput)),
      };
      if (kind === "character") patch.personality = personality;
      if (kind === "world") patch.setting_notes = settingNotes;
      onUpdated(patch);

      if (syncPublish) {
        const pubRes = await fetch(`${apiBase}/publish`, {
          method: "POST",
          headers: replayHeaders(),
        });
        const pubJson = await pubRes.json();
        if (pubJson.code === 200) {
          onStatusChange("published", pubJson.data?.publish_at ?? new Date().toISOString());
          message.success(status === "published" ? "已保存并同步到市场" : "已保存并上架");
        } else {
          message.warning(`内容已保存，但上架失败：${pubJson.msg ?? "未知错误"}`);
        }
      } else if (status === "published") {
        message.success("已保存，市场展示将同步更新");
      } else {
        message.success("已保存");
      }
    } finally {
      setBusy(false);
    }
  }

  async function publishOnly() {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/publish`, {
        method: "POST",
        headers: replayHeaders(),
      });
      const json = await res.json();
      if (json.code === 200) {
        onStatusChange("published", json.data?.publish_at ?? new Date().toISOString());
        message.success(status === "published" ? "已刷新市场展示" : "已上架到市场");
      } else {
        message.error(json.msg ?? "上架失败");
      }
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/unpublish`, { method: "POST" });
      const json = await res.json();
      if (json.code === 200) {
        onStatusChange("draft", null);
        message.success("已下架，可继续编辑后再次上架");
      } else {
        message.error(json.msg ?? "下架失败");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#DCE9FF] bg-white p-6 mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[#1F2A44] flex items-center gap-2">
          <span>✏️</span> 编辑{KIND_LABEL[kind]}
        </h3>
        <span className="sf-tag">{STATUS_LABELS[status] ?? status}</span>
      </div>
      <p className="mb-4 text-xs text-[#5B6B8C]">
        {status === "published"
          ? "保存后市场列表与详情会同步更新；也可下架修改后再「再次上架」。"
          : "修改后点击「保存并上架」或先保存再单独上架，内容将出现在市场。"}
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">
            {nameLabel} <span className="text-red-500">*</span>
          </label>
          <input
            className="sf-input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">简介</label>
          <textarea
            className="sf-input w-full min-h-20 resize-y"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={1000}
          />
        </div>

        {kind === "character" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">性格与动机</label>
            <textarea
              className="sf-input w-full min-h-28 resize-y"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              maxLength={8000}
            />
          </div>
        )}

        {kind === "world" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">世界设定</label>
            <textarea
              className="sf-input w-full min-h-36 resize-y"
              value={settingNotes}
              onChange={(e) => setSettingNotes(e.target.value)}
              maxLength={8000}
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">标签</label>
          <input
            className="sf-input w-full"
            placeholder="逗号或空格分隔"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="sf-btn-primary"
          disabled={busy}
          onClick={() => void saveChanges(false)}
        >
          {busy ? "处理中…" : "保存修改"}
        </button>
        {status !== "published" ? (
          <button
            type="button"
            className="sf-btn-secondary"
            disabled={busy}
            onClick={() => void saveChanges(true)}
          >
            保存并上架
          </button>
        ) : (
          <>
            <button
              type="button"
              className="sf-btn-secondary"
              disabled={busy}
              onClick={() => void saveChanges(true)}
            >
              保存并同步市场
            </button>
            <button
              type="button"
              className="sf-tag"
              disabled={busy}
              onClick={() => confirmUnpublish(kind, name.trim(), () => unpublish())}
            >
              下架
            </button>
          </>
        )}
        {status !== "published" && (
          <button type="button" className="sf-tag" disabled={busy} onClick={() => void publishOnly()}>
            再次上架
          </button>
        )}
        {kind === "story" && (
          <Link href={`/stories/${id}/edit`} className="sf-tag">
            大纲编辑
          </Link>
        )}
      </div>
    </div>
  );
}
