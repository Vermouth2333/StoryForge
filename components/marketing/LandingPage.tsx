"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, BookOpen, Users, Globe, Theater, Wand2, Image, Video, Coins } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Gamepad2, Sparkles, Store } from "@/components/icons";
import { ShowcaseStage, type ShowcaseItem } from "@/components/marketing/ShowcaseStage";

const NAV = [
  { href: "#assets", label: "内容类型" },
  { href: "#features", label: "能做什么" },
  { href: "#studio", label: "创作能力" },
  { href: "#flow", label: "如何开始" },
];

const FEATURES: ShowcaseItem[] = [
  {
    title: "人设面具",
    desc: "用自己的身份走进故事。面具只属于你：可改设定与开场，但不上架、也不售卖，避免把「我是谁」变成商品。",
    sticker: "paper",
    tilt: "left",
  },
  {
    title: "故事是舞台",
    desc: "故事里的角色都是 NPC。戴上面具进场后，故事会先开口；你用行动续写，关系与剧情一起往前走。",
    sticker: "blue",
    tilt: "right",
  },
  {
    title: "好感会生长",
    desc: "每次对话都会推进好感档位；每个 NPC 各自累积。语气、称呼和态度会随关系从陌生走向羁绊。",
    sticker: "soft",
    tilt: "left",
  },
  {
    title: "下载到本地",
    desc: "市场给的是一份你自己的副本，不是在线引用。作者改稿、下架或删作，都不影响你已经保存的版本。",
    sticker: "sky",
    tilt: "right",
  },
];

const STEPS: ShowcaseItem[] = [
  {
    kicker: "01",
    title: "发现&创作",
    desc: "在市场浏览故事、角色与世界，点进详情看简介、标签，确认这是你想进入的舞台，或者你也可以创建属于你的故事",
    sticker: "soft",
    tilt: "left",
  },
  {
    kicker: "02",
    title: "下载",
    desc: "把作品存进「我的」。之后的对话、配图和导出都基于这份本地副本。",
    sticker: "paper",
    tilt: "right",
  },
  {
    kicker: "03",
    title: "戴上面具",
    desc: "选择人设面具作为「我」。进入故事前先确认身份，故事中的角色会按这个身份来回应你。",
    sticker: "blue",
    tilt: "left",
  },
  {
    kicker: "04",
    title: "互动",
    desc: "作品先开口。你可以续写、配图、把回复做成短视频，也可以随时导出这次冒险。",
    sticker: "sky",
    tilt: "right",
  },
];

const ASSETS: ShowcaseItem[] = [
  {
    kicker: "可发布到市场",
    title: "故事卡",
    desc: "带开场与角色关系的可体验剧本，读者戴面具进入后由故事先开口。",
    sticker: "paper",
    tilt: "left",
  },
  {
    kicker: "可发布到市场",
    title: "角色卡",
    desc: "可单独对话的 NPC：性格、问候语和封面都会带到聊天里。",
    sticker: "blue",
    tilt: "right",
  },
  {
    kicker: "可发布到市场",
    title: "世界卡",
    desc: "舞台与设定集，用来托住故事背景，也可直接进去探索。",
    sticker: "sky",
    tilt: "left",
  },
  {
    kicker: "私有 · 不可上架",
    title: "人设面具",
    desc: "你的私有身份，只用于进场扮演，不会出现在市场货架上。",
    sticker: "soft",
    tilt: "right",
  },
];

const STUDIO_CARDS = [
  {
    icon: Wand2,
    title: "对话续写",
    desc: "登录即可聊，不必自己填模型地址或密钥。回复流式出现，按次扣除积分。",
    tone: "primary",
  },
  {
    icon: Image,
    title: "场景插画",
    desc: "一键画成小说插画：二次元绘本或厚涂质感，避免真人写实和字幕水印。",
    tone: "character",
  },
  {
    icon: Video,
    title: "剧情短视频",
    desc: "把一段回复演成约 30 秒连贯短片：后一镜接着前一镜的结束画面，跟封面或已生成配图同一套造型与配色。",
    tone: "world",
  },
  {
    icon: Coins,
    title: "积分即可创作",
    desc: "注册即送体验积分。对话、配图、配视频各自计价。",
    tone: "star",
  },
];

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const assets = useInView();
  const features = useInView();
  const studio = useInView();
  const flow = useInView();
  const cta = useInView();

  return (
    <div className="sf-landing-root relative overflow-hidden">
      <div aria-hidden className="sf-landing-grid pointer-events-none absolute inset-x-0 top-0 h-[720px]" />
      
      <div aria-hidden className="sf-landing-orb-container">
        <div className="sf-landing-orb sf-landing-orb--primary" />
        <div className="sf-landing-orb sf-landing-orb--secondary" />
        <div className="sf-landing-orb sf-landing-orb--accent" />
      </div>

      <header className={`sf-landing-header ${scrolled ? "sf-landing-header--scrolled" : ""}`}>
        <div className="sf-landing-nav mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-3 md:px-5">
          <Link href="/" className="sf-focus-ring rounded-lg no-underline" aria-label="StoryForge 官网">
            <BrandLogo size={32} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="sf-landing-nav-link sf-focus-ring rounded-lg px-3 py-2"
              >
                {item.label}
              </a>
            ))}
            <Link href="/market" className="sf-landing-nav-link sf-focus-ring rounded-lg px-3 py-2">
              逛市场
            </Link>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/login?next=/market"
              className="sf-landing-btn sf-landing-btn-nav sf-focus-ring no-underline"
            >
              登录
            </Link>
          </div>
          <button
            type="button"
            className="sf-landing-mobile-menu sf-focus-ring md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="打开菜单"
          >
            <span className={`sf-hamburger ${menuOpen ? "sf-hamburger--open" : ""}`}>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
        
        <div className={`sf-landing-mobile-drawer ${menuOpen ? "sf-landing-mobile-drawer--open" : ""}`}>
          <div className="sf-landing-nav mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-2xl p-3 md:hidden">
            {NAV.map((item, i) => (
              <a
                key={item.href}
                href={item.href}
                className="sf-mobile-nav-item sf-focus-ring"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/market"
              className="sf-mobile-nav-item sf-focus-ring"
              style={{ animationDelay: `${NAV.length * 50}ms` }}
              onClick={() => setMenuOpen(false)}
            >
              逛市场
            </Link>
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <Link
                href="/login?next=/market"
                className="sf-landing-btn sf-landing-btn-primary w-full justify-center no-underline"
                onClick={() => setMenuOpen(false)}
              >
                登录
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="sf-hero sf-stage-enter">
          <div className="sf-hero-container mx-auto max-w-6xl px-4">
            <div className="sf-hero-content">
              <div className="sf-hero-text sf-stagger">
                <p className="sf-landing-chip sf-hover-scale">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
                  AI 角色互动平台
                </p>
                <h1 className="sf-landing-hero-title">
                  <span className="sf-hero-line">戴上面具，</span>
                  <span className="sf-hero-line">走进别人写的世界。</span>
                </h1>
                <p className="sf-hero-desc">
                  作者在这里创作故事、角色与世界，读者则戴上自己的面具走进其中。不是对着空白对话框，而是选身份、进场景、去冒险。
                </p>
                <div className="sf-hero-actions">
                  <Link href="/register" className="sf-landing-btn sf-landing-btn-primary sf-hover-glow no-underline">
                    注册
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/market" className="sf-landing-btn sf-landing-btn-ghost sf-lift no-underline">
                    先逛市场
                  </Link>
                </div>
              </div>

              <div className="sf-hero-visual">
                <HeroPreview />
                <FloatingCards />
              </div>
            </div>

            <div className="sf-hero-stats sf-stagger">
              <StatPill icon={BookOpen} label="故事" value="1000+" />
              <StatPill icon={Users} label="角色" value="5000+" />
              <StatPill icon={Globe} label="世界" value="300+" />
              <StatPill icon={Theater} label="创作者" value="2000+" />
            </div>
          </div>

          <div className="sf-hero-scroll-hint" aria-hidden>
            <span className="sf-scroll-indicator" />
            <span className="sf-scroll-text">向下滚动探索</span>
          </div>
        </section>

        <section
          id="assets"
          ref={assets.ref as React.RefObject<HTMLElement>}
          className={`sf-section ${assets.isInView ? "sf-section--visible" : ""}`}
        >
          <div className="sf-section-inner mx-auto max-w-6xl px-4">
            <SectionHead
              kicker="内容模型"
              title="三种可上架，一种只属于你"
              desc="故事、角色、世界可以发布到市场被下载；人设面具只用来扮演，永远不会出现在货架上。"
              isInView={assets.isInView}
            />
            <div className={`sf-section-content ${assets.isInView ? "sf-stagger" : ""}`}>
              <ShowcaseStage items={ASSETS} variant="assets" />
            </div>
          </div>
        </section>

        <section
          id="features"
          ref={features.ref as React.RefObject<HTMLElement>}
          className={`sf-section sf-section--alt ${features.isInView ? "sf-section--visible" : ""}`}
        >
          <div className="sf-section-inner mx-auto max-w-6xl px-4">
            <SectionHead
              kicker="产品能力"
              title="从发现到相遇，一整条互动链路"
              desc="不是对着空白对话框开聊：先选作品、再选身份，进场后由故事开口。对话会推进好感，你的本地副本也不会被作者改稿带走。"
              isInView={features.isInView}
            />
            <div className={`sf-section-content ${features.isInView ? "sf-stagger" : ""}`}>
              <ShowcaseStage items={FEATURES} variant="features" />
            </div>
          </div>
        </section>

        <section
          id="studio"
          ref={studio.ref as React.RefObject<HTMLElement>}
          className={`sf-section ${studio.isInView ? "sf-section--visible" : ""}`}
        >
          <div className="sf-section-inner mx-auto max-w-6xl px-4">
            <SectionHead
              kicker="创作能力"
              title="你负责把故事演下去"
              desc="对话、插画和短视频"
              isInView={studio.isInView}
            />
            <div className={`sf-studio-grid ${studio.isInView ? "sf-stagger" : ""}`}>
              {STUDIO_CARDS.map((item, i) => (
                <StudioCard key={item.title} {...item} index={i} />
              ))}
            </div>
          </div>
        </section>

        <section
          id="flow"
          ref={flow.ref as React.RefObject<HTMLElement>}
          className={`sf-section sf-section--alt ${flow.isInView ? "sf-section--visible" : ""}`}
        >
          <div className="sf-section-inner mx-auto max-w-6xl px-4">
            <SectionHead
              kicker="使用路径"
              title="四步进入故事"
              desc="未登录也能先逛市场；注册后下载、戴面具、对话、配图和配视频会一起打开。"
              isInView={flow.isInView}
            />
            <div className={`sf-section-content ${flow.isInView ? "sf-stagger" : ""}`}>
              <ShowcaseStage items={STEPS} variant="flow" />
            </div>
          </div>
        </section>

        <section
          ref={cta.ref as React.RefObject<HTMLElement>}
          className={`sf-section ${cta.isInView ? "sf-section--visible" : ""}`}
        >
          <div className="mx-auto max-w-6xl px-4 pb-20">
            <div className={`sf-cta-card ${cta.isInView ? "sf-scale-in" : "opacity-0"}`}>
              <div className="sf-cta-glow" aria-hidden />
              <div className="sf-cta-content">
                <p className="sf-cta-kicker">开始冒险</p>
                <h2 className="sf-cta-title">准备好相遇了吗？</h2>
                <p className="sf-cta-desc">
                  注册后进入市场，下载一张故事或角色卡，戴上面具即可开始。平台已接好对话与影像模型，有积分就能聊、能画、能做成短视频。
                </p>
              </div>
              <div className="sf-cta-actions">
                <Link href="/register" className="sf-landing-btn sf-landing-btn-primary sf-hover-glow no-underline">
                  注册
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login?next=/market" className="sf-landing-btn sf-landing-btn-ghost sf-lift no-underline">
                  登录
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="sf-footer">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <BrandLogo size={28} />
            <p className="text-sm text-[var(--text-secondary)]">
              © {new Date().getFullYear()} StoryForge · storyforge.fun
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({
  kicker,
  title,
  desc,
  isInView,
}: {
  kicker: string;
  title: string;
  desc?: string;
  isInView?: boolean;
}) {
  return (
    <div className={`sf-section-head ${isInView ? "sf-reveal" : "opacity-0"}`}>
      <p className="sf-section-kicker">{kicker}</p>
      <h2 className="sf-section-title">{title}</h2>
      {desc ? <p className="sf-section-desc">{desc}</p> : null}
    </div>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="sf-stat-pill sf-lift sf-hover-glow">
      <Icon className="sf-stat-pill-icon" />
      <div className="sf-stat-pill-content">
        <span className="sf-stat-pill-value">{value}</span>
        <span className="sf-stat-pill-label">{label}</span>
      </div>
    </div>
  );
}

function StudioCard({
  icon: Icon,
  title,
  desc,
  tone,
  index,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  tone: string;
  index: number;
}) {
  return (
    <article className="sf-studio-card sf-lift" style={{ animationDelay: `${index * 80}ms` }}>
      <div className={`sf-studio-card-icon sf-icon-tone-${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="sf-studio-card-title">{title}</h3>
      <p className="sf-studio-card-desc">{desc}</p>
    </article>
  );
}

function FloatingCards() {
  return (
    <div className="sf-floating-cards" aria-hidden>
      <div className="sf-floating-card sf-floating-card--1">
        <BookOpen className="h-5 w-5 text-[var(--story-color)]" />
      </div>
      <div className="sf-floating-card sf-floating-card--2">
        <Users className="h-5 w-5 text-[var(--character-color)]" />
      </div>
      <div className="sf-floating-card sf-floating-card--3">
        <Globe className="h-5 w-5 text-[var(--world-color)]" />
      </div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="sf-hero-window sf-lift">
      <div className="sf-hero-window-header">
        <span className="sf-window-dot sf-window-dot--red" />
        <span className="sf-window-dot sf-window-dot--yellow" />
        <span className="sf-window-dot sf-window-dot--green" />
      </div>
      <div className="sf-hero-window-content">
        <div className="sf-hero-window-titlebar">
          <div>
            <p className="sf-hero-window-name">雨巷里的最后一班电车</p>
            <p className="sf-hero-window-meta">面具：巡夜人 · NPC 全员在场</p>
          </div>
          <span className="sf-hero-window-badge">
            好感 42 · 友好
          </span>
        </div>
        <div className="sf-hero-window-messages">
          <div className="sf-preview-message sf-preview-message--npc sf-message-enter">
            <p>末世前夜的霓虹还没熄。车门开了一条缝，她看着你，像在确认一封还没送到的信。</p>
            <span className="sf-preview-message-tag">开场语 · 故事先说</span>
          </div>
          <div className="sf-preview-message sf-preview-message--user sf-message-enter" style={{ animationDelay: "0.15s" }}>
            我是今晚的巡夜人。这封信，我送到。
          </div>
          <div className="sf-preview-input sf-message-enter" style={{ animationDelay: "0.3s" }}>
            <Gamepad2 className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span>输入你的行动指令…</span>
            <Store className="ml-auto h-3.5 w-3.5 opacity-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
