/**
 * 数据恢复脚本（次要功能）。
 *
 * ⚠️ 破坏性操作：会覆盖当前 storage/db/storyforge.sqlite 与 storage/users/。
 * 必须显式传入备份目录参数，否则拒绝执行。
 *
 * 用法（Node 22.6+ 支持类型擦除）：
 *   node --experimental-strip-types scripts/restore.ts <备份目录> [--yes]
 *   例：node --experimental-strip-types scripts/restore.ts backups/backup_2024-01-01T00-00-00-000Z --yes
 *
 * 不带 --yes 时仅打印将执行的操作（dry-run），不做任何修改。
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, "storage", "db");
const DB_PATH = path.join(DB_DIR, "storyforge.sqlite");
const USERS_DIR = path.join(ROOT, "storage", "users");

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const backupDir = args.find((a) => !a.startsWith("--"));
  const confirmed = args.includes("--yes");

  if (!backupDir) {
    console.error("[restore] 缺少备份目录参数。用法：restore.ts <备份目录> [--yes]");
    process.exit(1);
  }

  const absBackup = path.resolve(ROOT, backupDir);
  if (!(await pathExists(absBackup))) {
    console.error(`[restore] 备份目录不存在：${absBackup}`);
    process.exit(1);
  }

  const backupDb = path.join(absBackup, "storyforge.sqlite");
  const backupUsers = path.join(absBackup, "users");
  const hasDb = await pathExists(backupDb);
  const hasUsers = await pathExists(backupUsers);

  if (!hasDb && !hasUsers) {
    console.error(`[restore] 备份目录内未找到 storyforge.sqlite 或 users/：${absBackup}`);
    process.exit(1);
  }

  if (!confirmed) {
    console.log("[restore] dry-run（未传 --yes，不做任何修改）。将执行：");
    if (hasDb) console.log(`  覆盖数据库：${backupDb} -> ${DB_PATH}（并清理 -wal/-shm）`);
    if (hasUsers) console.log(`  覆盖用户文件：${backupUsers} -> ${USERS_DIR}`);
    console.log("[restore] 确认无误后追加 --yes 执行。");
    return;
  }

  if (hasDb) {
    await fs.mkdir(DB_DIR, { recursive: true });
    // 清理可能残留的 WAL/SHM，避免与恢复的主库不一致
    await fs.rm(`${DB_PATH}-wal`, { force: true });
    await fs.rm(`${DB_PATH}-shm`, { force: true });
    await fs.copyFile(backupDb, DB_PATH);
    console.log(`[restore] 数据库已恢复 <- ${backupDb}`);
  }

  if (hasUsers) {
    await fs.rm(USERS_DIR, { recursive: true, force: true });
    await fs.cp(backupUsers, USERS_DIR, { recursive: true });
    console.log(`[restore] 用户文件已恢复 <- ${backupUsers}`);
  }

  console.log("[restore] 完成。");
}

main().catch((err) => {
  console.error("[restore] 失败：", err);
  process.exit(1);
});
