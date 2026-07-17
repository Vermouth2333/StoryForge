"use client";

import { useRef, useState } from "react";
import { App } from "antd";
import type { WorkImportKind, WorkImportResult } from "@/lib/work-import-parse";

export type WorkImportFields = WorkImportResult;

type WorkImportPanelProps = {
  kind: WorkImportKind;
  onParsed: (data: WorkImportFields) => void;
};

const ACCEPT =
  ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

const ALLOWED_EXT = new Set(["pdf", "doc", "docx", "txt"]);

function isAllowedFile(file: File): boolean {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase()
    : "";
  if (ALLOWED_EXT.has(ext)) return true;
  const mime = (file.type || "").toLowerCase();
  return (
    mime === "text/plain" ||
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export default function WorkImportPanel({ kind, onParsed }: WorkImportPanelProps) {
  const { message } = App.useApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const kindLabel =
    kind === "story" ? "故事" : kind === "character" ? "角色卡" : "世界卡";

  function pickFile(next: File | null) {
    if (!next) {
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!isAllowedFile(next)) {
      message.error("仅支持 PDF、DOC、DOCX、TXT");
      return;
    }
    setFile(next);
  }

  async function runParse() {
    if (!file && !text.trim()) {
      message.warning("请先上传文件或粘贴文本");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("kind", kind);
      if (text.trim()) form.set("text", text.trim());
      if (file) form.set("file", file);

      const res = await fetch("/api/works/import-parse", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (json.code !== 200) {
        message.error(json.msg ?? "解析失败");
        return;
      }
      const data = json.data as WorkImportFields & { truncated?: boolean; model_name?: string };
      onParsed(data);
      const tips = [
        "已填入解析结果，请核对后保存",
        data.model_name ? `（模型：${data.model_name}）` : "",
        data.truncated ? "；原文过长已截断后再解析" : "",
      ]
        .join("")
        .trim();
      message.success(tips);
    } catch {
      message.error("解析请求失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[#BFD4FF] bg-[#F8FBFF] p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[#1F2A44]">导入 / AI 解析</p>
        <p className="mt-0.5 text-xs text-[#5B6B8C]">
          支持 PDF、DOC、DOCX、TXT（可拖拽），或直接粘贴文本；将用你在设置中配置的默认模型解析
          {kindLabel}字段（消耗 API Token）。
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#5B6B8C]">上传文件</label>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null);
            }}
          />
          <div
            role="button"
            tabIndex={0}
            className={[
              "flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
              dragging
                ? "border-[#5B9DFF] bg-[#EEF6FF]"
                : "border-[#DCE9FF] bg-white hover:border-[#5B9DFF] hover:bg-[#F8FBFF]",
              busy ? "pointer-events-none opacity-60" : "",
            ].join(" ")}
            onClick={() => !busy && fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
              const dropped = e.dataTransfer.files?.[0] ?? null;
              pickFile(dropped);
            }}
          >
            {file ? (
              <>
                <p className="text-sm font-medium text-[#1F2A44]">{file.name}</p>
                <p className="text-xs text-[#5B6B8C]">点击更换，或继续拖拽新文件到此处</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[#1F2A44]">
                  {dragging ? "松开以上传文件" : "拖拽文件到此处，或点击选择"}
                </p>
                <p className="text-xs text-[#5B6B8C]">PDF / DOC / DOCX / TXT</p>
              </>
            )}
          </div>
          {file ? (
            <button
              type="button"
              className="sf-tag mt-2 text-xs"
              disabled={busy}
              onClick={() => pickFile(null)}
            >
              清除文件
            </button>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#5B6B8C]">或粘贴文本</label>
          <textarea
            className="sf-input min-h-24 w-full resize-y text-sm"
            placeholder="粘贴角色设定、世界观说明、故事大纲等…"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="sf-btn-primary"
          disabled={busy || (!file && !text.trim())}
          onClick={() => void runParse()}
        >
          {busy ? "AI 解析中…" : "AI 解析并填入表单"}
        </button>
      </div>
    </div>
  );
}
