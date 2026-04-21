import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

async function addColumnIfMissing(db: Database, table: string, column: string, ddlFragment: string) {
  const cols = await db.all<{ name: string }[]>(`PRAGMA table_info(${table})`);
  const names = new Set(cols.map((r) => r.name));
  if (!names.has(column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddlFragment}`);
  }
}

async function migrateSchema(db: Database) {
  await db.exec("PRAGMA foreign_keys = ON;");

  const storiesCols = await db.all<{ name: string }[]>("PRAGMA table_info(stories)");
  const storyNames = new Set(storiesCols.map((r) => r.name));
  if (!storyNames.has("cover_asset_id")) {
    await db.exec("ALTER TABLE stories ADD COLUMN cover_asset_id TEXT");
  }

  await addColumnIfMissing(db, "users", "gender", "gender TEXT");
  await addColumnIfMissing(db, "users", "age", "age INTEGER");
  await addColumnIfMissing(db, "users", "phone_masked", "phone_masked TEXT");
  await addColumnIfMissing(db, "users", "bio", "bio TEXT");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      summary TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      like_count INTEGER NOT NULL DEFAULT 0,
      favorite_count INTEGER NOT NULL DEFAULT 0,
      publish_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      name TEXT NOT NULL,
      cover_asset_id TEXT,
      summary TEXT DEFAULT '',
      setting_notes TEXT DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      like_count INTEGER NOT NULL DEFAULT 0,
      favorite_count INTEGER NOT NULL DEFAULT 0,
      publish_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_characters_status_publish
      ON characters(status, publish_at DESC);

    CREATE INDEX IF NOT EXISTS idx_worlds_status_publish
      ON worlds(status, publish_at DESC);

    CREATE TABLE IF NOT EXISTS story_outline_nodes (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'chapter',
      sort_order INTEGER NOT NULL DEFAULT 0,
      content TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_outline_story_parent_sort
      ON story_outline_nodes(story_id, parent_id, sort_order);

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, target_type, target_id)
    );

    CREATE INDEX IF NOT EXISTS idx_favorites_user_created
      ON favorites(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS character_relations (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      character_left_id TEXT NOT NULL,
      character_right_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(story_id, character_left_id, character_right_id)
    );

    CREATE INDEX IF NOT EXISTS idx_char_relations_story
      ON character_relations(story_id);

    CREATE TABLE IF NOT EXISTS basic_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      category TEXT DEFAULT '',
      message TEXT NOT NULL,
      meta_json TEXT NOT NULL DEFAULT '{}',
      user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_basic_logs_created
      ON basic_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      label TEXT DEFAULT '',
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_session_created
      ON snapshots(session_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_world_sort
      ON knowledge_entries(world_id, sort_order, id);

    CREATE TABLE IF NOT EXISTS story_branches (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      parent_branch_id TEXT,
      fork_outline_node_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_story_branches_story_status
      ON story_branches(story_id, status);

    CREATE INDEX IF NOT EXISTS idx_story_branches_fork
      ON story_branches(story_id, fork_outline_node_id);

    CREATE INDEX IF NOT EXISTS idx_story_branches_parent
      ON story_branches(story_id, parent_branch_id);

    CREATE TABLE IF NOT EXISTS moderation_items (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      submitter_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      audit_remark TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_moderation_status_created
      ON moderation_items(status, created_at DESC);
  `);

  await addColumnIfMissing(db, "characters", "favorite_count", "favorite_count INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "worlds", "favorite_count", "favorite_count INTEGER NOT NULL DEFAULT 0");
}


const STORAGE_ROOT = path.join(process.cwd(), "storage");
const DB_DIR = path.join(STORAGE_ROOT, "db");
const DB_PATH = path.join(DB_DIR, "storyforge.sqlite");

let dbPromise: Promise<Database> | null = null;

async function ensureStorage() {
  await fs.mkdir(DB_DIR, { recursive: true });
}

async function initSchema(db: Database) {
  await db.exec("PRAGMA journal_mode=WAL;");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      username TEXT,
      avatar_url TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      tags_json TEXT NOT NULL DEFAULT '[]',
      like_count INTEGER NOT NULL DEFAULT 0,
      favorite_count INTEGER NOT NULL DEFAULT 0,
      publish_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_type TEXT NOT NULL,
      story_id TEXT,
      character_id TEXT,
      world_id TEXT,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      last_message_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      token_input INTEGER DEFAULT 0,
      token_output INTEGER DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      model_name TEXT DEFAULT 'mock-model',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, target_type, target_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, author_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      receiver_user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_receiver
      ON notifications(receiver_user_id, is_read, created_at DESC);

    CREATE TABLE IF NOT EXISTS feed_impressions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      story_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feed_clicks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      story_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  await migrateSchema(db);
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      await ensureStorage();
      const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
      });
      await initSchema(db);
      return db;
    })();
  }
  return dbPromise;
}

export function nowIso() {
  return new Date().toISOString();
}

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}
