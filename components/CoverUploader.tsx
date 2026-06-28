"use client";

import { useRef, useState } from "react";
import { message } from "antd";

interface CoverUploaderProps {
  /** 上传接口地址，例如 /api/characters/char_xxx/cover */
  endpoint: string;
  /** 当前封面 URL（来自后端 cover_url），可为空 */
  coverUrl?: string | null;
  /** 缩略图 URL，可选 */
  thumbnailUrl?: string | null;
  /** 上传成功后回调，传入新的封面 URL */
  onUploaded?: (coverUrl: string) => void;
  /** 标签文字 */
  label?: string;
}

export default function CoverUploader({
  endpoint,
  coverUrl,
  thumbnailUrl,
  onUploaded,
  label = "封面图",
}: CoverUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(
    coverUrl || thumbnailUrl || null,
  );

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      message.error("文件大小超过 10MB 限制");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      message.error("仅支持 JPG/PNG/WebP 格式");
      return;
    }
    // 本地预览
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const json = await res.json();
      if (json.code === 200) {
        const newUrl = json.data?.cover_url as string;
        if (newUrl) setPreview(newUrl);
        message.success(json.msg ?? "封面上传成功");
        onUploaded?.(newUrl);
      } else {
        message.error(json.msg ?? "封面上传失败");
        // 失败回退
        setPreview(coverUrl || thumbnailUrl || null);
      }
    } catch {
      message.error("封面上传失败");
      setPreview(coverUrl || thumbnailUrl || null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">{label}</label>
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-dashed border-[#DCE9FF] bg-[#F8FBFF]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="封面预览" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[#5B6B8C]">
              暂无封面
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-xs text-[#5B9DFF]">
              上传中...
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <button
            type="button"
            className="sf-btn-secondary text-xs"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "上传中..." : preview ? "更换封面" : "上传封面"}
          </button>
          <p className="text-xs text-[#5B6B8C]">JPG/PNG/WebP，≤10MB</p>
        </div>
      </div>
    </div>
  );
}
