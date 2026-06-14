import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-7xl">📭</div>
      <h1 className="text-2xl font-bold text-[#1F2A44]">页面不存在</h1>
      <p className="max-w-md text-sm text-[#5B6B8C]">
        你访问的页面可能已被移动或删除，请检查地址是否正确。
      </p>
      <Link href="/" className="sf-btn-primary">
        返回首页
      </Link>
    </main>
  );
}
