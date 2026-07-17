"use client";

import { message } from "antd";
import { useEffect, useRef, useState } from "react";
import CoverDisplay from "@/components/CoverDisplay";
import CoverFieldLabel from "@/components/CoverFieldLabel";

const COVER_HINT =
  "JPG/PNG/WebP，≤10MB，可选。点击封面图上传或更换，预览效果与市场展示一致。";

type CoverFileFieldProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
};

export default function CoverFileField({
  file,
  onChange,
  label = "封面图",
}: CoverFileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFile(next: File) {
    if (next.size > 10 * 1024 * 1024) {
      message.error("文件大小超过 10MB 限制");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      message.error("仅支持 JPG/PNG/WebP 格式");
      return;
    }
    onChange(next);
  }

  function openPicker() {
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
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="group relative block w-full max-w-[320px] cursor-pointer border-0 bg-transparent p-0 text-left"
        onClick={openPicker}
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 text-sm font-medium text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          {preview ? "点击更换" : "点击上传"}
        </div>
      </button>
    </div>
  );
}
