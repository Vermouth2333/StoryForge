"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = (await res.json()) as { code: number; msg?: string };
      if (!res.ok || json.code !== 200) {
        setError(json.msg || "登录失败");
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sf-card space-y-5 p-6 md:p-8">
      <div>
        <h2 className="text-xl font-semibold text-[#1F2A44]">登录</h2>
        <p className="mt-1 text-sm text-[#5B6B8C]">使用用户名和密码登录</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[#1F2A44]" htmlFor="username">
          用户名
        </label>
        <input
          id="username"
          className="sf-input w-full"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[#1F2A44]" htmlFor="password">
          密码
        </label>
        <input
          id="password"
          type="password"
          className="sf-input w-full"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" className="sf-btn-primary w-full" disabled={loading}>
        {loading ? "登录中…" : "登录"}
      </button>

      <p className="text-center text-sm text-[#5B6B8C]">
        还没有账号？{" "}
        <Link href="/register" className="text-[#5B9DFF] no-underline hover:underline">
          立即注册
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="sf-card p-8 text-center text-sm text-[#5B6B8C]">加载中…</div>}>
      <LoginForm />
    </Suspense>
  );
}
