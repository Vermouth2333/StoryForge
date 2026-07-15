"use client";

import { message } from "antd";
import { useEffect, useRef, useState } from "react";
import CoverDisplay from "@/components/CoverDisplay";

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

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#1F2A44]">{label}</label>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <CoverDisplay
          src={preview}
          alt="封面预览"
          placeholder={
            <div className="market-card-placeholder">
              <span className="text-sm text-[#5B6B8C]">暂无封面</span>
            </div>
          }
        />
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            type="button"
            className="sf-btn-secondary text-xs"
            onClick={() => inputRef.current?.click()}
          >
            {preview ? "更换封面" : "选择封面"}
          </button>
          {preview && (
            <button
              type="button"
              className="text-xs text-[#5B6B8C] hover:text-[#8B2E2E]"
              onClick={() => {
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              移除
            </button>
          )}
          <p className="text-xs text-[#5B6B8C]">JPG/PNG/WebP，≤10MB，可选。预览效果与市场展示一致。</p>
        </div>
      </div>
    </div>
  );
}
