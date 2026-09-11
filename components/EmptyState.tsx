import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconBadge, type IconTone } from "@/components/icons";

export function EmptyState({
  icon,
  tone = "primary",
  title,
  description,
  action,
  className = "",
}: {
  icon: LucideIcon;
  tone?: IconTone;
  title?: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sf-empty-state sf-reveal flex flex-col items-center justify-center px-6 py-12 text-center ${className}`.trim()}>
      <div className="sf-empty-icon-wrapper mb-5">
        <div className="sf-empty-icon-glow" aria-hidden />
        <IconBadge icon={icon} tone={tone} size="xl" className="sf-empty-icon relative z-10" />
      </div>
      {title ? (
        <p className="sf-empty-title mb-2 text-base font-semibold text-[var(--foreground)]">{title}</p>
      ) : null}
      <div className="sf-empty-desc max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </div>
      {action ? <div className="sf-empty-action mt-5">{action}</div> : null}
    </div>
  );
}
