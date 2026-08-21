import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/LandingPage";
import { getCurrentUserId } from "@/lib/auth";

export const metadata = {
  title: "StoryForge · AI 角色互动平台",
  description:
    "用人设面具走进故事：作者创作并发布故事卡、角色卡与世界卡，读者下载到本地与 NPC 互动，好感随对话生长。",
};

export default async function HomePage() {
  const userId = await getCurrentUserId();
  if (userId) {
    redirect("/market");
  }
  return <LandingPage />;
}
