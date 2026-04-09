PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  phone_masked TEXT,
  phone_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  cover_asset_id TEXT,
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
  session_type TEXT NOT NULL, -- story/character/world
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
  role TEXT NOT NULL, -- system/user/assistant
  content TEXT NOT NULL,
  token_input INTEGER NOT NULL DEFAULT 0,
  token_output INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  model_name TEXT DEFAULT 'mock-model',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL, -- story/character/world
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
  type TEXT NOT NULL, -- liked/followed/author_update/system
  payload_json TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_stories_status_publish
  ON stories(status, publish_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_receiver
  ON notifications(receiver_user_id, is_read, created_at DESC);
