/** 逗号分隔的用户 ID 列表，与 Cookie / x-user-id 一致。未配置则不存在管理员（全部 403）。 */
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
