/**
 * 数据备份脚本（次要功能）。
 *
 * 备份内容：
 *  - SQLite 主库：使用 `VACUUM INTO` 生成一致性单文件快照（WAL 模式安全）。
 *  - storage/users/ 用户文件目录：递归复制。
 *
 * 产物：backups/backup_<timestamp>/ 下含 storyforge.sqlite 与 users/。
 *
 * 运行（Node 22.6+ 支持类型擦除）：
 *   node --experimental-strip-types scripts/backup.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "storage", "db", "storyforge.sqlite");
const USERS_DIR = path.join(ROOT, "storage", "users");
const BACKUP_ROOT = path.join(ROOT, "backups");

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function backupDatabase(targetPath: string): Promise<void> {
  if (!(await pathExists(DB_PATH))) {
    console.warn(`[backup] 数据库文件不存在，跳过：${DB_PATH}`);
    return;
  }
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  try {
    // VACUUM INTO 在 WAL 模式下生成一致性快照，无需停机
    await db.exec(`VACUUM INTO '${targetPath.replace(/'/g, "''")}'`);
    console.log(`[backup] 数据库已备份 -> ${targetPath}`);
  } finally {
    await db.close();
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  if (!(await pathExists(src))) {
    console.warn(`[backup] 目录不存在，跳过：${src}`);
    return;
  }
  await fs.cp(src, dest, { recursive: true });
  console.log(`[backup] 用户文件已备份 -> ${dest}`);
}

async function main(): Promise<void> {
  const dir = path.join(BACKUP_ROOT, `backup_${timestamp()}`);
  await fs.mkdir(dir, { recursive: true });

  await backupDatabase(path.join(dir, "storyforge.sqlite"));
  await copyDir(USERS_DIR, path.join(dir, "users"));

  console.log(`[backup] 完成：${dir}`);
}

main().catch((err) => {
  console.error("[backup] 失败：", err);
  process.exit(1);
});
