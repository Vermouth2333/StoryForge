import type { ReactNode } from "react";
import { AnimatedTitle } from "@/components/AnimatedTitle";

/** 紧凑页头：与市场/创作/我的统一风格，高度更小 */
export function PageHero({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sf-hero-banner sf-hero-compact sf-reveal ${className}`.trim()}>
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <AnimatedTitle>{title}</AnimatedTitle>
          {subtitle ? <p className="section-subtitle mt-1 max-w-xl">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
