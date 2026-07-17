import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconBadge, type IconTone } from "@/components/icons";

export function EmptyState({
  icon,
  tone = "primary",
  title,
  description,
  className = "",
}: {
  icon: LucideIcon;
  tone?: IconTone;
  title?: string;
  description: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 py-10 text-center ${className}`.trim()}>
      <IconBadge icon={icon} tone={tone} size="xl" className="mb-4" />
      {title ? <p className="mb-1 text-base font-semibold text-[#1F2A44]">{title}</p> : null}
      <div className="max-w-md text-sm leading-relaxed text-[#5B6B8C]">{description}</div>
    </div>
  );
}
