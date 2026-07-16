"use client";

import { usePathname } from "next/navigation";

/** 路由切换时给主内容区一个轻量入场动效 */
export default function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="sf-page-enter">
      {children}
    </div>
  );
}
