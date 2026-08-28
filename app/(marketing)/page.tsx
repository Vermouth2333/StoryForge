import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/LandingPage";
import { getCurrentUserId } from "@/lib/auth";

export const metadata = {
  title: "StoryForge · AI 角色互动平台",
  description:
    "用人设面具走进故事：市场下载故事、角色与世界卡，平台提供对话续写、插画与配视频，积分按次消费，无需自备模型密钥。",
};

export default async function HomePage() {
  const userId = await getCurrentUserId();
  if (userId) {
    redirect("/market");
  }
  return <LandingPage />;
}
