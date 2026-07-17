"use client";

import { useId } from "react";

type BrandLogoProps = {
  /** 侧栏折叠时只显示图标 + SF */
  compact?: boolean;
  /** 是否显示文字 */
  showWordmark?: boolean;
  /** 图标尺寸（px） */
  size?: number;
  className?: string;
};

function WaveWordmark({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`sf-wordmark sf-wordmark-wave ${className}`.trim()} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="sf-wave-letter"
          style={{ animationDelay: `${i * 0.07}s, 0s` }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

/** StoryForge 品牌标：开书 + 火花；文字波浪跳动 + 渐变滚动 */
export function BrandLogo({
  compact = false,
  showWordmark = true,
  size = 32,
  className = "",
}: BrandLogoProps) {
  const uid = useId().replace(/:/g, "");
  const bgId = `sfLogoBg_${uid}`;
  const pageId = `sfLogoPage_${uid}`;

  return (
    <span className={`sf-brand-mark ${className}`.trim()}>
      <span className="sf-logo-bounce" style={{ width: size, height: size }} aria-hidden>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 64 64"
          width={size}
          height={size}
          fill="none"
          className="block"
        >
          <defs>
            <linearGradient id={bgId} x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7FB4FF" />
              <stop offset="1" stopColor="#3F86F5" />
            </linearGradient>
            <linearGradient id={pageId} x1="18" y1="18" x2="46" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#EAF3FF" />
            </linearGradient>
          </defs>
          <rect x="4" y="4" width="56" height="56" rx="16" fill={`url(#${bgId})`} />
          <path
            d="M32 20.5c-3.2-2.4-7.4-3.5-12.2-3.5-1.4 0-2.5 1.1-2.5 2.5v22.2c0 1.2 1 2.2 2.2 2.2 4.4 0 8.2 1 10.7 2.8.5.4 1.2.4 1.7 0 2.5-1.8 6.3-2.8 10.7-2.8 1.2 0 2.2-1 2.2-2.2V19.5c0-1.4-1.1-2.5-2.5-2.5-4.8 0-9 1.1-12.3 3.5Z"
            fill={`url(#${pageId})`}
          />
          <path
            d="M32 20.5v26.7"
            stroke="#5B9DFF"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M45.5 14.5 47 18.2l3.7 1.5-3.7 1.5-1.5 3.7-1.5-3.7-3.7-1.5 3.7-1.5 1.5-3.7Z"
            fill="#FFE08A"
          />
          <circle cx="20" cy="16" r="1.6" fill="#FFE08A" opacity="0.9" />
        </svg>
      </span>
      {showWordmark ? (
        <WaveWordmark text={compact ? "SF" : "StoryForge"} className={compact ? "text-lg" : "text-xl"} />
      ) : null}
    </span>
  );
}
