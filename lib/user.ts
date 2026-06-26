import type { Database } from "sqlite";
import { nowIso } from "@/lib/db";

export async function ensureUserRow(db: Database, userId: string) {
  const row = await db.get<{ id: string }>("SELECT id FROM users WHERE id = ?", userId);
  if (row) return;
  const now = nowIso();
  const suffix = userId.replace(/\W/g, "").slice(-6) || "user";
  await db.run(
    `INSERT INTO users (id, email, username, avatar_url, status, created_at, updated_at)
     VALUES (?, NULL, ?, NULL, 'active', ?, ?)`,
    userId,
    `用户_${suffix}`,
    now,
    now,
  );
}

/** Google OAuth：用户主键为 `google_${sub}`。已注销账号重新登录时复活为活跃账号。 */
export async function ensureGoogleUser(
  db: Database,
  googleSub: string,
  profile: {
    email?: string | null;
    name?: string | null;
    picture?: string | null;
  },
) {
  const id = `google_${googleSub}`;
  const row = await db.get<{ id: string; status: string }>(
    "SELECT id, status FROM users WHERE id = ?",
    id,
  );
  const now = nowIso();
  const displayName =
    (profile.name && profile.name.trim()) ||
    (profile.email && profile.email.split("@")[0]) ||
    `用户_${googleSub.slice(-6)}`;

  if (!row) {
    await db.run(
      `INSERT INTO users (id, email, username, avatar_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      id,
      profile.email ?? null,
      displayName,
      profile.picture ?? null,
      now,
      now,
    );
    return;
  }

  // 已注销账号重新登录：复活为活跃账号，恢复 Google 资料
  const fields: string[] = ["status = 'active'", "updated_at = ?"];
  const values: unknown[] = [now];
  if (profile.email) {
    fields.push("email = ?");
    values.push(profile.email);
  }
  // 已注销时 username 被改为「已注销用户」，恢复为 Google 名称
  fields.push("username = ?");
  values.push(displayName);
  if (profile.picture) {
    fields.push("avatar_url = ?");
    values.push(profile.picture);
  }
  values.push(id);
  await db.run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, ...values);
}
