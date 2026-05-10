PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  gender TEXT,
  age INTEGER,
  phone_masked TEXT,
  phone_verified_at TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_stories_status_publish
  ON stories(status, publish_at DESC);

CREATE INDEX IF NOT EXISTS idx_characters_status_publish
  ON characters(status, publish_at DESC);

CREATE INDEX IF NOT EXISTS idx_worlds_status_publish
  ON worlds(status, publish_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_receiver
  ON notifications(receiver_user_id, is_read, created_at DESC);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL, -- story/character/world
  target_id TEXT NOT NULL,
  parent_comment_id TEXT, -- 回复的评论
  content TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id, created_at DESC);

-- 评论点赞表
CREATE TABLE IF NOT EXISTS comment_likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, comment_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (comment_id) REFERENCES comments(id)
);

-- 评分表
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL, -- story/character/world
  target_id TEXT NOT NULL,
  rating INTEGER NOT NULL, -- 1-5
  content TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, target_type, target_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id, created_at DESC);

-- 资源文件表
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

-- 二创关系表
CREATE TABLE IF NOT EXISTS derivative_relations (
  id TEXT PRIMARY KEY,
  derived_work_type TEXT NOT NULL, -- story/character/world
  derived_work_id TEXT NOT NULL,
  original_work_type TEXT NOT NULL, -- story/character/world
  original_work_id TEXT NOT NULL,
  relation_type TEXT NOT NULL, -- inspired_by/remix/continuation
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_derivative_derived ON derivative_relations(derived_work_type, derived_work_id);
CREATE INDEX IF NOT EXISTS idx_derivative_original ON derivative_relations(original_work_type, original_work_id);

-- 会话存档表
CREATE TABLE IF NOT EXISTS session_archives (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT, -- 用户自定义命名
  message_id TEXT NOT NULL, -- 存档点的最后一条消息
  content_snapshot_json TEXT NOT NULL, -- 会话内容快照
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_session_archives_session ON session_archives(session_id, created_at DESC);

-- 文风锚点表
CREATE TABLE IF NOT EXISTS story_style_anchors (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  features_json TEXT NOT NULL, -- StyleFeatures JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id)
);

-- 冲突检测日志表
CREATE TABLE IF NOT EXISTS conflict_detection_logs (
  id TEXT PRIMARY KEY,
  story_id TEXT,
  character_id TEXT,
  world_id TEXT,
  content TEXT,
  conflict_level TEXT, -- P0/P1/P2
  conflict_details_json TEXT, -- ConflictResult JSON
  created_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id),
  FOREIGN KEY (character_id) REFERENCES characters(id),
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

-- 一致性校验日志表
CREATE TABLE IF NOT EXISTS consistency_check_logs (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL,
  chapter_id TEXT,
  violations_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id)
);

-- 分支节点表
CREATE TABLE IF NOT EXISTS branch_nodes (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  parent_node_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (branch_id) REFERENCES story_branches(id)
);

