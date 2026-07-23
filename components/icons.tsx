import type { LucideIcon, LucideProps } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  Feather,
  Gamepad2,
  Globe2,
  Heart,
  History,
  Inbox,
  Library,
  Lock,
  Map,
  MessageSquareText,
  MessagesSquare,
  MousePointerClick,
  PenLine,
  Settings,
  Sparkles,
  Star,
  Store,
  Trash2,
  UserRound,
  VenetianMask,
} from "lucide-react";

export type IconTone =
  | "story"
  | "character"
  | "world"
  | "market"
  | "compose"
  | "user"
  | "history"
  | "settings"
  | "star"
  | "secure"
  | "ai"
  | "primary"
  | "notify"
  | "danger"
  | "empty";

type BadgeSize = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<BadgeSize, { box: string; icon: string }> = {
  sm: { box: "h-6 w-6 rounded-lg", icon: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8 rounded-xl", icon: "h-4 w-4" },
  lg: { box: "h-10 w-10 rounded-xl", icon: "h-5 w-5" },
  xl: { box: "h-14 w-14 rounded-2xl", icon: "h-7 w-7" },
};

const TONE_CLASS: Record<IconTone, string> = {
  story: "sf-icon-tone-story",
  character: "sf-icon-tone-character",
  world: "sf-icon-tone-world",
  market: "sf-icon-tone-market",
  compose: "sf-icon-tone-compose",
  user: "sf-icon-tone-user",
  history: "sf-icon-tone-history",
  settings: "sf-icon-tone-settings",
  star: "sf-icon-tone-star",
  secure: "sf-icon-tone-secure",
  ai: "sf-icon-tone-ai",
  primary: "sf-icon-tone-primary",
  notify: "sf-icon-tone-notify",
  danger: "sf-icon-tone-danger",
  empty: "sf-icon-tone-empty",
};

const TONE_MOTION: Record<IconTone, string> = {
  story: "sf-icon-motion-bob",
  character: "sf-icon-motion-spark",
  world: "sf-icon-motion-orbit",
  market: "sf-icon-motion-bob",
  compose: "sf-icon-motion-wiggle",
  user: "sf-icon-motion-bob",
  history: "sf-icon-motion-bob",
  settings: "sf-icon-motion-wiggle",
  star: "sf-icon-motion-spark",
  secure: "sf-icon-motion-pulse",
  ai: "sf-icon-motion-spark",
  primary: "sf-icon-motion-bob",
  notify: "sf-icon-motion-spark",
  danger: "sf-icon-motion-wiggle",
  empty: "sf-icon-motion-bob",
};

export function SfIcon({
  icon: Icon,
  className = "h-[1.15em] w-[1.15em]",
  strokeWidth = 2.15,
  ...rest
}: { icon: LucideIcon } & LucideProps) {
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden {...rest} />;
}

/** 带色底 + 轻动画的主题图标 */
export function IconBadge({
  icon,
  tone = "primary",
  size = "md",
  active = false,
  animated = true,
  className = "",
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: BadgeSize;
  active?: boolean;
  animated?: boolean;
  className?: string;
}) {
  const dim = SIZE_MAP[size];
  return (
    <span
      className={[
        "sf-icon-badge",
        dim.box,
        TONE_CLASS[tone],
        active ? "is-active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <span className={animated ? TONE_MOTION[tone] : undefined}>
        <SfIcon icon={icon} className={dim.icon} />
      </span>
    </span>
  );
}

/** 作品类型：故事 / 角色 / 世界 */
export function WorkTypeIcon({
  type,
  size = "md",
  animated = true,
  className = "",
  plain = false,
}: {
  type: "story" | "character" | "world" | string;
  size?: BadgeSize;
  animated?: boolean;
  className?: string;
  plain?: boolean;
}) {
  const tone: IconTone =
    type === "character" ? "character" : type === "world" ? "world" : "story";
  const icon =
    type === "character" ? VenetianMask : type === "world" ? Globe2 : BookOpen;

  if (plain) {
    const plainSize =
      size === "xl" ? "h-7 w-7" : size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    return (
      <SfIcon
        icon={icon}
        className={["sf-icon-plain", TONE_CLASS[tone], plainSize, className].filter(Boolean).join(" ")}
      />
    );
  }

  return (
    <IconBadge icon={icon} tone={tone} size={size} animated={animated} className={className} />
  );
}

export const NavIcons = {
  market: Store,
  compose: PenLine,
  my: UserRound,
  history: History,
  settings: Settings,
} as const;

export const NavTones = {
  market: "market",
  compose: "compose",
  my: "user",
  history: "history",
  settings: "settings",
} as const satisfies Record<keyof typeof NavIcons, IconTone>;

export {
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  Feather,
  Gamepad2,
  Globe2,
  Heart,
  History,
  Inbox,
  Library,
  Lock,
  Map,
  MessageSquareText,
  MessagesSquare,
  MousePointerClick,
  PenLine,
  Settings,
  Sparkles,
  Star,
  Store,
  Trash2,
  UserRound,
  VenetianMask,
};
