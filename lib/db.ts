import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";

async function addColumnIfMissing(db: Database, table: string, column: string, ddlFragment: string) {
  const cols = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  const names = new Set(Array.isArray(cols) ? cols.map((r) => r?.name).filter((n): n is string => Boolean(n)) : []);
  if (names.has(column)) return;
  try {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddlFragment}`);
  } catch (err) {
    // 列已存在时 SQLite 抛出 "duplicate column name"，安全忽略
    const msg = (err as Error)?.message ?? "";
    if (!/duplicate column/i.test(msg)) throw err;
  }
}

async function migrateCharacterRelationsAllowMultiple(db: Database) {
  const tables = (await db.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='character_relations'",
  )) as Array<{ name: string }>;
  if (tables.length === 0) return;

  const indexes = (await db.all("PRAGMA index_list(character_relations)")) as Array<{
    name: string;
    unique: number;
  }>;
  for (const idx of indexes) {
    if (idx.unique !== 1) continue;
    const cols = (await db.all(`PRAGMA index_info(${idx.name})`)) as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    if (
      names.length === 3 &&
      names.includes("story_id") &&
      names.includes("character_left_id") &&
      names.includes("character_right_id")
    ) {
      await db.exec(`
        CREATE TABLE character_relations__new (
          id TEXT PRIMARY KEY,
          story_id TEXT NOT NULL,
          character_left_id TEXT NOT NULL,
          character_right_id TEXT NOT NULL,
          relation_type TEXT NOT NULL,
          description TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO character_relations__new
          SELECT id, story_id, character_left_id, character_right_id, relation_type, description, created_at, updated_at
          FROM character_relations;
        DROP TABLE character_relations;
        ALTER TABLE character_relations__new RENAME TO character_relations;
        CREATE INDEX IF NOT EXISTS idx_char_relations_story ON character_relations(story_id);
        CREATE INDEX IF NOT EXISTS idx_char_relations_pair
          ON character_relations(story_id, character_left_id, character_right_id);
      `);
      return;
    }
  }
}

async function migrateSchema(db: Database) {
  await db.exec("PRAGMA foreign_keys = ON;");

  await addColumnIfMissing(db, "stories", "cover_asset_id", "cover_asset_id TEXT");

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
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_char_relations_story
      ON character_relations(story_id);

    CREATE INDEX IF NOT EXISTS idx_char_relations_pair
      ON character_relations(story_id, character_left_id, character_right_id);

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

    -- 社区功能表
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL, -- story/character/world
      target_id TEXT NOT NULL,
      parent_comment_id TEXT,
      content TEXT NOT NULL,
      like_count INTEGER NOT NULL DEFAULT 0,
      reply_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_comment_id) REFERENCES comments(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id, created_at DESC);
    
    CREATE TABLE IF NOT EXISTS comment_likes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      comment_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, comment_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (comment_id) REFERENCES comments(id)
    );
    
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      rating INTEGER NOT NULL, -- 1-5
      content TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, target_type, target_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id, created_at DESC);
    
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      asset_type TEXT NOT NULL, -- cover/illustration/other
      target_type TEXT, -- story/chapter/character/world
      target_id TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      file_size_bytes INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS derivative_relations (
      id TEXT PRIMARY KEY,
      derived_work_type TEXT NOT NULL,
      derived_work_id TEXT NOT NULL,
      original_work_type TEXT NOT NULL,
      original_work_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_derivative_derived ON derivative_relations(derived_work_type, derived_work_id);
    CREATE INDEX IF NOT EXISTS idx_derivative_original ON derivative_relations(original_work_type, original_work_id);
    
    CREATE TABLE IF NOT EXISTS session_archives (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT,
      message_id TEXT NOT NULL,
      content_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_session_archives_session ON session_archives(session_id, created_at DESC);
    
    CREATE TABLE IF NOT EXISTS story_style_anchors (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      features_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (story_id) REFERENCES stories(id)
    );
    
    CREATE TABLE IF NOT EXISTS conflict_detection_logs (
      id TEXT PRIMARY KEY,
      story_id TEXT,
      character_id TEXT,
      world_id TEXT,
      content TEXT,
      conflict_level TEXT,
      conflict_details_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (story_id) REFERENCES stories(id),
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (world_id) REFERENCES worlds(id)
    );
    
    CREATE TABLE IF NOT EXISTS consistency_check_logs (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      chapter_id TEXT,
      violations_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (story_id) REFERENCES stories(id)
    );
    
    CREATE TABLE IF NOT EXISTS branch_nodes (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL,
      parent_node_id TEXT,
      title TEXT NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (branch_id) REFERENCES story_branches(id)
    );
  `);

  await addColumnIfMissing(db, "characters", "favorite_count", "favorite_count INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "worlds", "favorite_count", "favorite_count INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "characters", "cover_asset_id", "cover_asset_id TEXT");
  await addColumnIfMissing(db, "worlds", "cover_asset_id", "cover_asset_id TEXT");
  await addColumnIfMissing(db, "characters", "draft_json", "draft_json TEXT");
  await addColumnIfMissing(db, "worlds", "draft_json", "draft_json TEXT");
  await addColumnIfMissing(db, "stories", "draft_json", "draft_json TEXT");

  // 会话级模型选择持久化
  await addColumnIfMissing(db, "chat_sessions", "model_id", "model_id TEXT");

  // 故事-角色关联表（引入角色卡到故事）
  await db.exec(`
    CREATE TABLE IF NOT EXISTS story_characters (
      story_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      PRIMARY KEY (story_id, character_id)
    );
  `);

  // 故事-世界关联表（引入世界卡到故事）
  await db.exec(`
    CREATE TABLE IF NOT EXISTS story_worlds (
      story_id TEXT NOT NULL,
      world_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (story_id, world_id)
    );
  `);

  // 用户级设置持久化（含默认模型等键值）
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );
  `);

  // 用户自定义模型配置（API Key 等敏感信息存储于此）
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_models (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      base_url TEXT,
      api_key_encrypted TEXT,
      model_name TEXT NOT NULL,
      default_temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 4096,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_models_user ON user_models(user_id, enabled, sort_order);
  `);

  // 防重放：敏感接口使用过的 nonce（5 分钟时窗内不可复用）
  await db.exec(`
    CREATE TABLE IF NOT EXISTS used_nonces (
      nonce TEXT PRIMARY KEY,
      user_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_used_nonces_created ON used_nonces(created_at);
  `);

  // RAG 向量缓存：持久化知识条目内容与 embedding，避免仅依赖进程内存
  await db.exec(`
    CREATE TABLE IF NOT EXISTS rag_vectors (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      world_id TEXT,
      content TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      embedding_json TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rag_vectors_world_type ON rag_vectors(world_id, type);
  `);

  await migrateCharacterRelationsAllowMultiple(db);
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
