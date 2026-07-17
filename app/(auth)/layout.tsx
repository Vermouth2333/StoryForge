import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#dceeff_0%,_#f7fafc_45%,_#eef3f8_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#5B9DFF]/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-[#7fb4ff]/20 blur-3xl"
      />

      <div className="relative z-10 mb-8 text-center">
        <Link
          href="/"
          className="inline-flex justify-center no-underline [&_.sf-wordmark]:text-3xl md:[&_.sf-wordmark]:text-4xl"
          aria-label="StoryForge 首页"
        >
          <BrandLogo size={48} className="justify-center" />
        </Link>
        <p className="mt-3 text-sm text-[#5B6B8C]">互动小说创作平台</p>
      </div>

      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
