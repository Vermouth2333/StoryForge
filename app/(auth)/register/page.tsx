"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = (await res.json()) as { code: number; msg?: string };
      if (!res.ok || json.code !== 200) {
        setError(json.msg || "注册失败");
        return;
      }
      router.replace("/");
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
        <h2 className="text-xl font-semibold text-[#1F2A44]">注册</h2>
        <p className="mt-1 text-sm text-[#5B6B8C]">创建账号后即可创作与互动</p>
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
          placeholder="3–32 个字符"
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 8 位"
          required
          minLength={8}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[#1F2A44]" htmlFor="confirm">
          确认密码
        </label>
        <input
          id="confirm"
          type="password"
          className="sf-input w-full"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" className="sf-btn-primary w-full" disabled={loading}>
        {loading ? "注册中…" : "注册并登录"}
      </button>

      <p className="text-center text-sm text-[#5B6B8C]">
        已有账号？{" "}
        <Link href="/login" className="text-[#5B9DFF] no-underline hover:underline">
          去登录
        </Link>
      </p>
    </form>
  );
}
