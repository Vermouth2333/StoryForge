"use client";

import { App } from "antd";
import { useEffect, useState } from "react";
import { IconBadge, Sparkles } from "@/components/icons";
import { PageHero } from "@/components/PageHero";

type CreditsPayload = {
  balance: number;
  costs: { chat: number; image: number; video: number };
  packages: Array<{ id: string; name: string; credits: number; priceLabel: string; blurb: string }>;
};

export default function CreditsPage() {
  const { message } = App.useApp();
  const [data, setData] = useState<CreditsPayload | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/credits");
    const json = await res.json().catch(() => null);
    if (json?.code === 200) setData(json.data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function fakeCheckout(pkgId: string) {
    setBusyId(pkgId);
    try {
      const res = await fetch("/api/credits/checkout", { method: "POST" });
      const json = await res.json().catch(() => null);
      message.info(json?.msg ?? "当前环境未开通在线支付，请联系开发者发放积分");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        title="积分"
        subtitle="对话、配图与配视频按次消耗积分。"
      />

      <div className="sf-card p-6">
        <p className="text-sm text-[#5B6B8C]">当前余额</p>
        <p className="mt-1 text-3xl font-semibold text-[#1F2A44]">{data?.balance ?? "—"}</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#F8FBFF] p-3 text-sm text-[#5B6B8C]">
            对话 {data?.costs.chat ?? 2} 积分 / 次
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-3 text-sm text-[#5B6B8C]">
            配图 {data?.costs.image ?? 8} 积分 / 次
          </div>
          <div className="rounded-xl bg-[#F8FBFF] p-3 text-sm text-[#5B6B8C]">
            配视频 {data?.costs.video ?? 30} 积分 / 次
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(data?.packages ?? []).map((pkg) => (
          <div key={pkg.id} className="sf-card flex flex-col p-6">
            <div className="mb-3 flex items-center gap-2">
              <IconBadge icon={Sparkles} tone="star" size="sm" />
              <h3 className="text-base font-semibold text-[#1F2A44]">{pkg.name}</h3>
            </div>
            <p className="text-2xl font-semibold text-[#1F2A44]">{pkg.credits} 积分</p>
            <p className="mt-1 text-sm text-[#5B6B8C]">{pkg.priceLabel}</p>
            <p className="mt-2 flex-1 text-sm text-[#5B6B8C]">{pkg.blurb}</p>
            <button
              type="button"
              className="sf-btn-primary mt-4"
              disabled={busyId === pkg.id}
              onClick={() => void fakeCheckout(pkg.id)}
            >
              {busyId === pkg.id ? "处理中…" : "充值"}
            </button>
          </div>
        ))}
      </div>
   </div>
  );
}
