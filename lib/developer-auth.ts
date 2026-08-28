import { getDb } from "@/lib/db";

export const DEVELOPER_USERNAME = "nastume";

export function isDeveloperUsername(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === DEVELOPER_USERNAME;
}

export async function isDeveloperUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const db = await getDb();
  const row = await db.get<{ username: string | null }>("SELECT username FROM users WHERE id = ?", userId);
  return isDeveloperUsername(row?.username);
}

export async function requireDeveloper(userId: string | null | undefined): Promise<boolean> {
  return isDeveloperUser(userId);
}
