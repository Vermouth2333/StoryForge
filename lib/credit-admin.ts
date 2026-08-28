import { isPlatformAdmin } from "@/lib/admin-auth";

/** 积分管理 / 审核台：环境管理员或测试管理员账号 nastume */
export async function canManageCredits(userId: string | null | undefined): Promise<boolean> {
  return isPlatformAdmin(userId);
}
