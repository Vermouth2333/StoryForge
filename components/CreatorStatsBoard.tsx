"use client";

import { useEffect, useState } from "react";
import { BookOpen, Download, Heart, Star, UserRound } from "lucide-react";
import type { StatsRange, StatsTotals, StatsBucket } from "@/lib/creator-stats";

const RANGES: Array<{ id: StatsRange; label: string }> = [
  { id: "day", label: "日" },
  { id: "month", label: "月" },
  { id: "year", label: "年" },
];

const METRICS: Array<{
  key: keyof StatsTotals;
  label: string;
  hint: string;
  icon: typeof Download;
}> = [
  { key: "downloads", label: "下载", hint: "下载了你的作品", icon: Download },
  { key: "reads", label: "阅读", hint: "进入你的作品对话", icon: BookOpen },
  { key: "likes", label: "点赞", hint: "点赞了你的作品", icon: Heart },
  { key: "follows", label: "关注", hint: "关注了你", icon: UserRound },
  { key: "favorites", label: "收藏", hint: "收藏了你的作品", icon: Star },
];

export function CreatorStatsBoard({ heading = true }: { heading?: boolean }) {
  const [range, setRange] = useState<StatsRange>("day");
  const [totals, setTotals] = useState<StatsTotals | null>(null);
  const [series, setSeries] = useState<StatsBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/me/stats?range=${range}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.code === 200 && json.data) {
          setTotals(json.data.totals);
          setSeries(json.data.series ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const maxBar = Math.max(
    1,
    ...series.flatMap((b) => [b.downloads, b.reads, b.likes, b.follows, b.favorites]),
  );

  return (
    <div className="sf-card p-6">
      <div className={`mb-4 flex flex-wrap items-center gap-3 ${heading ? "justify-between" : "justify-end"}`}>
      {heading ? (
        <div>
          <h3 className="text-lg font-bold text-[#1f2a44]">作品数据看板</h3>
          <p className="mt-1 text-xs text-[#5B6B8C]">统计有多少人与你的作品互动（按所选周期）</p>
        </div>
      ) : null}
        <div className="flex gap-2">
          {RANGES.map((r) => {
            const active = range === r.id;
            return (
              <button
                key={r.id}
                type="button"
                className={[
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-medium",
                  active
                    ? "bg-[#5B9DFF] text-white"
                    : "bg-[#EEF6FF] text-[#5B6B8C] hover:bg-[#DCE9FF]",
                ].join(" ")}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const value = totals?.[m.key] ?? 0;
          return (
            <div key={m.key} className="rounded-xl border border-[#DCE9FF] bg-[#F8FBFF] px-4 py-3">
              <div className="flex items-center gap-1.5 text-[#5B6B8C]">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="text-xs">{m.label}</span>
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[#1F2A44]">
                {loading && !totals ? "—" : value}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8A97B3]">{m.hint}</p>
            </div>
          );
        })}
      </div>

      {series.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="text-[#8A97B3]">
                <th className="pb-2 font-medium">周期</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="pb-2 font-medium">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((row) => (
                <tr key={row.label} className="border-t border-[#EEF6FF] text-[#1F2A44]">
                  <td className="py-2 font-medium">{row.label}</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="py-2 tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        {row[m.key]}
                        <span
                          className="inline-block h-1.5 rounded-full bg-[#5B9DFF]/70"
                          style={{ width: `${Math.max(4, (row[m.key] / maxBar) * 48)}px` }}
                        />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
