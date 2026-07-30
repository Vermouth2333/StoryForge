"use client";

import { App } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import WorkImportPanel from "@/components/WorkImportPanel";

type PersonaMask = {
  id: string;
  name: string;
  summary: string;
  appearance: string;
  personality: string;
  background: string;
  speech_style: string;
  tags_json: string;
};

export default function PersonaMaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const [mask, setMask] = useState<PersonaMask | null>(null);
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/persona-masks/${params.id}`);
      const json = await res.json();
      if (json.code === 200) {
        setMask(json.data);
        try {
          setTags((JSON.parse(json.data.tags_json || "[]") as string[]).join(", "));
        } catch {
          setTags("");
        }
      } else {
        message.error(json.msg ?? "加载失败");
      }
      setLoading(false);
    })();
  }, [message, params.id]);

  async function save() {
    if (!mask?.name.trim()) {
      message.error("名称不能为空");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/persona-masks/${mask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mask.name.trim(),
          summary: mask.summary,
          appearance: mask.appearance,
          personality: mask.personality,
          background: mask.background,
          speech_style: mask.speech_style,
          tags: tags.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
        }),
      });
      const json = await res.json();
      if (json.code === 200) message.success("已保存");
      else message.error(json.msg ?? "保存失败");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!mask) return;
    modal.confirm({
      title: "删除人设面具",
      content: `确定删除「${mask.name}」？此操作不可恢复。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        const res = await fetch(`/api/persona-masks/${mask.id}`, { method: "DELETE" });
        const json = await res.json();
        if (json.code === 200) {
          message.success("已删除");
          router.push("/my");
        } else message.error(json.msg ?? "删除失败");
      },
    });
  }

  if (loading) return <main className="sf-loading" />;
  if (!mask) return <main className="mx-auto max-w-3xl p-6 text-[#5B6B8C]">人设面具不存在</main>;

  const fields: Array<[keyof PersonaMask, string, number, string]> = [
    ["summary", "简介", 1000, "简要描述你扮演的身份与处境…"],
    ["appearance", "外貌", 2000, "描述外貌：身高、发型、穿着等…"],
    ["personality", "性格", 8000, "描述性格特质、处事态度、优缺点…"],
    ["background", "背景", 4000, "描述过往经历、出身与关键记忆…"],
    ["speech_style", "说话风格", 2000, "描述语气、口头禅、常用表达方式…"],
  ];
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <Link href="/my" className="sf-tag">← 返回我的</Link>
        <span className="sf-tag">私有 · 不上架</span>
      </div>
      <div className="sf-card space-y-5 p-6">
        <div>
          <h1 className="text-xl font-semibold text-[#1F2A44]">编辑人设面具</h1>
          <p className="mt-1 text-sm text-[#5B6B8C]">用于定义你在故事和对话中的身份。</p>
        </div>
        <WorkImportPanel
          kind="persona"
          onParsed={(data) => {
            setMask({
              ...mask,
              name: data.title || mask.name,
              summary: data.summary,
              appearance: data.appearance ?? "",
              personality: data.personality ?? "",
              background: data.background ?? "",
              speech_style: data.speech_style ?? "",
            });
            setTags((data.tags ?? []).join(", "));
          }}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">名称 *</label>
          <input
            className="sf-input w-full"
            placeholder="如：旅人小羽"
            value={mask.name}
            maxLength={120}
            onChange={(e) => setMask({ ...mask, name: e.target.value })}
          />
        </div>
        {fields.map(([key, label, maxLength, placeholder]) => (
          <div key={key}>
            <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">{label}</label>
            <textarea
              className="sf-input min-h-24 w-full resize-y"
              placeholder={placeholder}
              value={mask[key]}
              maxLength={maxLength}
              onChange={(e) => setMask({ ...mask, [key]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">标签</label>
          <input
            className="sf-input w-full"
            placeholder="用逗号或空格分隔，如：旅人, 冷静, 观察者"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <button className="sf-btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "保存中..." : "保存"}</button>
          <button className="sf-btn-secondary !border-red-200 !text-red-600" disabled={busy} onClick={remove}>删除</button>
        </div>
      </div>
    </main>
  );
}
