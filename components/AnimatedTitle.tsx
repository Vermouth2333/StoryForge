/** 页面主标题：渐变艺术字（无跳动） */
export function AnimatedTitle({
  children,
  as: Tag = "h2",
  className = "",
}: {
  children: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return <Tag className={`sf-page-title ${className}`.trim()}>{children}</Tag>;
}
