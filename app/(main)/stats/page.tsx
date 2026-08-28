"use client";

import { CreatorStatsBoard } from "@/components/CreatorStatsBoard";
import { PageHero } from "@/components/PageHero";

export default function StatsPage() {
  return (
    <div className="space-y-5">
      <PageHero
        title="作品数据看板"
        subtitle="按日 / 月 / 年查看下载、阅读、点赞、关注和收藏"
      />
      <CreatorStatsBoard heading={false} />
    </div>
  );
}
