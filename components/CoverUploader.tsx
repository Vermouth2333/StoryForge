"use client";

import { useEffect, useRef, useState } from "react";
import { message } from "antd";
import CoverDisplay from "@/components/CoverDisplay";
import CoverFieldLabel from "@/components/CoverFieldLabel";

const COVER_HINT =
  "JPG/PNG/WebP，≤10MB。点击封面图上传或更换，预览效果与市场展示一致。";

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

  useEffect(() => {
    setPreview(coverUrl || thumbnailUrl || null);
  }, [coverUrl, thumbnailUrl]);

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

  function openPicker() {
    if (busy) return;
    inputRef.current?.click();
  }

  return (
    <div>
      <CoverFieldLabel label={label} hint={COVER_HINT} />
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
        className="group relative block w-full max-w-[320px] cursor-pointer border-0 bg-transparent p-0 text-left disabled:cursor-not-allowed"
        onClick={openPicker}
        disabled={busy}
        aria-label={preview ? "更换封面" : "上传封面"}
      >
        <CoverDisplay
          src={preview}
          alt="封面预览"
          uploadEmpty
          placeholder={
            <div className="market-card-placeholder">
              <span className="sf-cover-upload-hint">点击上传封面</span>
            </div>
          }
        />
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-sm text-white">
            上传中...
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 text-sm font-medium text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
            {preview ? "点击更换" : "点击上传"}
          </div>
        )}
      </button>
    </div>
  );
}
