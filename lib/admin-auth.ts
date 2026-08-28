import { isDeveloperUser } from "@/lib/developer-auth";

/** 逗号分隔的用户 ID 列表，与 Cookie / x-user-id 一致。 */
export function parseAdminUserIds(): string[] {
  return (process.env.STORYFORGE_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return parseAdminUserIds().includes(userId);
}

/** 环境管理员 ID，或测试管理员账号 nastume */
export async function isPlatformAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  if (isAdminUser(userId)) return true;
  return isDeveloperUser(userId);
}
