import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

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
