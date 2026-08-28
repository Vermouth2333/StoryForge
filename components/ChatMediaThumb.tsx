"use client";

import { Modal } from "antd";
import { Play, X, ZoomIn } from "lucide-react";
import { useState } from "react";

type Kind = "image" | "video";

export function ChatMediaThumb(props: {
  kind: Kind;
  src: string;
  generating?: boolean;
  failed?: boolean;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = props.kind === "image" ? "查看配图" : "播放视频";
  const removeLabel = props.kind === "image" ? "删除配图" : "删除视频";

  return (
    <>
      <div className="flex flex-col items-start gap-1">
      <div className="relative h-[100px] w-[100px] shrink-0">
        <button
          type="button"
          className="group relative h-full w-full overflow-hidden rounded-lg bg-black"
          onClick={() => {
            if (props.generating || !props.src) return;
            setOpen(true);
          }}
          disabled={props.generating || !props.src}
          aria-label={props.generating ? "生成中" : label}
        >
          {props.src && props.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.src} alt="" className="h-full w-full object-contain" />
          ) : null}
          {props.src && props.kind === "video" ? (
            <video src={props.src} muted playsInline className="h-full w-full object-contain" />
          ) : null}
          {props.generating ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-[10px] font-medium text-white">
              生成中
            </span>
          ) : (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
              {props.kind === "image" ? (
                <ZoomIn className="h-7 w-7 text-white" aria-hidden />
              ) : (
                <Play className="h-7 w-7 text-white" aria-hidden />
              )}
            </span>
          )}
        </button>
        {props.onRemove ? (
          <button
            type="button"
            className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#1F2A44]/85 text-white shadow-md ring-2 ring-white/90 transition hover:bg-[#E11D48] disabled:opacity-50"
            aria-label={removeLabel}
            title={removeLabel}
            disabled={props.removing}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (props.removing) return;
              props.onRemove?.();
            }}
          >
            <X className="h-3 w-3" strokeWidth={2.6} aria-hidden />
          </button>
        ) : null}
      </div>
      {props.failed ? <p className="text-[11px] text-[#8B2E2E]">生成失败，可重试</p> : null}
      </div>
      <Modal
        centered
        title={props.kind === "image" ? "配图" : "视频"}
        open={open}
        footer={null}
        onCancel={() => setOpen(false)}
        width={720}
        destroyOnHidden
      >
        {props.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.src} alt="配图" className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
        ) : (
          <video src={props.src} controls autoPlay playsInline className="mx-auto max-h-[70vh] w-full bg-black" />
        )}
      </Modal>
    </>
  );
}
