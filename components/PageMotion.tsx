"use client";

import { usePathname } from "next/navigation";

/** 路由切换时给主内容区一个轻量入场动效 */
export default function PageMotion({
  children,
  fillHeight = false,
}: {
  children: React.ReactNode;
  fillHeight?: boolean;
}) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className={["sf-page-enter", fillHeight ? "flex h-full min-h-0 flex-col" : ""].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
