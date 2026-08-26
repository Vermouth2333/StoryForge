"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Gamepad2, Sparkles, Store } from "@/components/icons";
import { ShowcaseStage, type ShowcaseItem } from "@/components/marketing/ShowcaseStage";

const NAV = [
  { href: "#assets", label: "内容类型" },
  { href: "#features", label: "能做什么" },
  { href: "#flow", label: "如何开始" },
];

const FEATURES: ShowcaseItem[] = [
  {
    title: "人设面具",
    desc: "用自己的身份走进故事。面具只属于你，不上架、也不售卖。",
    sticker: "paper",
    tilt: "left",
  },
  {
    title: "故事是舞台",
    desc: "故事里的角色都是 NPC。戴上面具进场，故事会先开口，再由你续写。",
    sticker: "blue",
    tilt: "right",
  },
  {
    title: "好感会生长",
    desc: "对话会推进好感档位；每个 NPC 各自累积，语气随关系亲近而悄然变化。",
    sticker: "soft",
    tilt: "left",
  },
  {
    title: "下载到本地",
    desc: "市场提供的是下载，不是在线引用。作者改稿或下架，都不影响你已保存的版本。",
    sticker: "sky",
    tilt: "right",
  },
];

const STEPS: ShowcaseItem[] = [
  {
    kicker: "01",
    title: "发现",
    desc: "在市场浏览故事、角色与世界，点进详情了解设定。",
    sticker: "soft",
    tilt: "left",
  },
  {
    kicker: "02",
    title: "下载",
    desc: "免费下载到「我的」。内容成为你的本地副本。",
    sticker: "paper",
    tilt: "right",
  },
  {
    kicker: "03",
    title: "戴上面具",
    desc: "选择人设面具作为「我」。进入故事前，先确认你要扮演的身份。",
    sticker: "blue",
    tilt: "left",
  },
  {
    kicker: "04",
    title: "互动",
    desc: "作品先开口。对话推进剧情，好感从陌生走向羁绊。",
    sticker: "sky",
    tilt: "right",
  },
];

const ASSETS: ShowcaseItem[] = [
  {
    kicker: "可发布到市场",
    title: "故事卡",
    desc: "可体验的剧本",
    sticker: "paper",
    tilt: "left",
  },
  {
    kicker: "可发布到市场",
    title: "角色卡",
    desc: "故事中的 NPC",
    sticker: "blue",
    tilt: "right",
  },
  {
    kicker: "可发布到市场",
    title: "世界卡",
    desc: "舞台与设定集",
    sticker: "sky",
    tilt: "left",
  },
  {
    kicker: "私有 · 不可上架",
    title: "人设面具",
    desc: "你的私有身份",
    sticker: "soft",
    tilt: "right",
  },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="sf-landing-grid pointer-events-none absolute inset-x-0 top-0 h-[720px]" />
      <div
        aria-hidden
        className="sf-landing-orb h-72 w-72 bg-[#5B9DFF]/25 left-[-80px] top-24"
      />
      <div
        aria-hidden
        className="sf-landing-orb h-80 w-80 bg-[#7FB4FF]/20 right-[-60px] top-40"
      />

      <header className="sticky top-0 z-50 px-4 pt-4">
        <div className="sf-landing-nav mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-3 md:px-5">
          <Link href="/" className="no-underline" aria-label="StoryForge 官网">
            <BrandLogo size={32} />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#5B6B8C] md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-[#3F86F5]">
                {item.label}
              </a>
            ))}
            <Link href="/market" className="hover:text-[#3F86F5]">
              逛市场
            </Link>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/login?next=/market" className="sf-landing-btn sf-landing-btn-nav no-underline">
              登录
            </Link>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[#DCE9FF] px-3 py-2 text-sm text-[#1F2A44] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            菜单
          </button>
        </div>
        {menuOpen ? (
          <div className="sf-landing-nav mx-auto mt-2 flex max-w-6xl flex-col gap-3 rounded-2xl p-4 md:hidden">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-[#1F2A44]"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link href="/market" className="text-sm text-[#1F2A44]" onClick={() => setMenuOpen(false)}>
              逛市场
            </Link>
            <Link
              href="/login?next=/market"
              className="sf-landing-btn sf-landing-btn-primary no-underline"
              onClick={() => setMenuOpen(false)}
            >
              登录
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 md:grid-cols-[1.05fr_0.95fr] md:pt-20">
          <div>
            <p className="sf-landing-chip">
              <Sparkles className="h-3.5 w-3.5 text-[#3F86F5]" />
              AI 角色互动平台
            </p>
            <h1 className="sf-landing-hero-title mt-5 text-4xl font-bold leading-[1.15] tracking-tight md:text-6xl">
              戴上面具，
              <br />
              走进别人写的世界。
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5B6B8C] md:text-lg">
              作者在这里创作故事、角色与世界，读者则戴上自己的面具走进其中。
              不是对着空白对话框，而是选身份、进场景、去冒险。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className="sf-landing-btn sf-landing-btn-primary no-underline">
                注册
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/market" className="sf-landing-btn sf-landing-btn-ghost no-underline">
                先逛市场
              </Link>
            </div>
          </div>

          <HeroPreview />
        </section>

        <section id="assets" className="mx-auto max-w-6xl px-4 py-8 md:py-16">
          <SectionHead kicker="内容模型" title="三种可上架，一种只属于你" />
          <ShowcaseStage items={ASSETS} />
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-8 md:py-16">
          <SectionHead
            kicker="产品能力"
            title="从发现到相遇，一整条互动链路"
            desc="从发现、下载，到戴上面具登场，每一步都清晰可控。"
          />
          <ShowcaseStage items={FEATURES} />
        </section>

        <section id="flow" className="mx-auto max-w-6xl px-4 py-8 md:py-16">
          <SectionHead
            kicker="使用路径"
            title="四步进入故事"
            desc="未登录也能先逛市场；登录后，下载、创作、对话全部打开。"
          />
          <ShowcaseStage items={STEPS} />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 pt-6">
          <div className="sf-landing-cta relative overflow-hidden rounded-[2rem] px-8 py-10 md:px-12 md:py-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-[#5B9DFF]/15 blur-2xl"
            />
            <div className="relative">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#5B9DFF]">开始冒险</p>
              <h2 className="mt-2 text-2xl font-bold text-[#1F2A44] md:text-3xl">准备好相遇了吗？</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#5B6B8C] md:text-base">
                注册后进入市场，下载一张故事或角色卡，戴上面具即可开始。接入你的 AI 模型，即可体验完整对话。
              </p>
            </div>
            <div className="relative flex flex-wrap items-center gap-3">
              <Link href="/register" className="sf-landing-btn sf-landing-btn-primary no-underline">
                注册
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login?next=/market" className="sf-landing-btn sf-landing-btn-ghost no-underline">
                登录
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#DCE9FF] bg-white/70">
        <p className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-[#5B6B8C]">
          © {new Date().getFullYear()} StoryForge · storyforge.fun
        </p>
      </footer>
    </div>
  );
}

function SectionHead({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.2em] text-[#5B9DFF]">{kicker}</p>
      <h2 className="mt-2 text-3xl font-bold text-[#1F2A44] md:text-4xl">{title}</h2>
      {desc ? <p className="mt-3 text-sm leading-6 text-[#5B6B8C] md:text-base">{desc}</p> : null}
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="sf-landing-window relative rounded-[1.6rem] p-3 md:p-4">
      <div className="mb-3 flex items-center gap-2 px-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FFB4B4]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FFE08A]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#9BD3B0]" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#DCE9FF] bg-[#F8FBFF]">
        <div className="flex items-center justify-between border-b border-[#DCE9FF] bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#1F2A44]">雨巷里的最后一班电车</p>
            <p className="text-xs text-[#5B6B8C]">面具：巡夜人 · NPC 全员在场</p>
          </div>
          <span className="rounded-full bg-[#EEF6FF] px-2.5 py-1 text-[10px] font-semibold text-[#3F86F5]">
            好感 42 · 友好
          </span>
        </div>
        <div className="space-y-3 p-4">
          <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm leading-6 text-[#1F2A44] shadow-sm">
            末世前夜的霓虹还没熄。车门开了一条缝，她看着你，像在确认一封还没送到的信。
            <p className="mt-2 text-xs text-[#5B9DFF]">开场语 · 故事先说</p>
          </div>
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-[#5B9DFF] px-4 py-3 text-sm text-white">
            我是今晚的巡夜人。这封信，我送到。
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#DCE9FF] bg-white px-3 py-2 text-xs text-[#5B6B8C]">
            <Gamepad2 className="h-3.5 w-3.5 text-[#5B9DFF]" />
            输入你的行动指令…
            <Store className="ml-auto h-3.5 w-3.5 opacity-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
