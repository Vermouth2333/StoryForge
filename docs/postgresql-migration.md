# PostgreSQL 迁移指南

## 迁移时机

当出现以下情况时，建议进行 SQLite 到 PostgreSQL 的迁移：

1. **数据库体积超过 2GB**
2. **并发用户数超过 100**
3. **写入操作出现明显瓶颈**
4. **需要支持更复杂的查询**

## 迁移策略

### 阶段 1：双写阶段

在完全切换之前，采用双写策略：

```typescript
// 双写示例
async function writeWithDualDB(data: any) {
  await sqliteDB.insert(data);
  await postgresqlDB.insert(data);
}
```

### 阶段 2：读流量切换

逐步将读流量切换到 PostgreSQL：

1. 先切换只读报表类查询
2. 然后切换详情页查询
3. 最后切换列表页查询

### 阶段 3：完全切换

确认 PostgreSQL 稳定后：

1. 停止双写
2. 保留 SQLite 作为备份
3. 监控性能指标

## 迁移步骤

### 1. 环境准备

```bash
# 安装 PostgreSQL
brew install postgresql@15
# 或 apt-get install postgresql-15

# 启动 PostgreSQL
brew services start postgresql@15
# 或 systemctl start postgresql-15
```

### 2. 创建数据库和用户

```sql
-- 创建数据库
CREATE DATABASE storyforge;

-- 创建用户
CREATE USER storyforge_user WITH PASSWORD 'your_password';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE storyforge TO storyforge_user;
\c storyforge
GRANT ALL ON SCHEMA public TO storyforge_user;
```

### 3. 创建表结构

参考 `docs/sqlite_schema.sql`，创建对应的 PostgreSQL 表结构：

```sql
-- 示例：用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_status ON users(status);
```

### 4. 数据迁移脚本

```typescript
// scripts/migrate-to-postgres.ts

import Database from 'better-sqlite3';
import { Client } from 'pg';

const sqlite = new Database('./storyforge.db');
const pg = new Client({
  host: 'localhost',
  database: 'storyforge',
  user: 'storyforge_user',
  password: process.env.PG_PASSWORD,
});

async function migrate() {
  await pg.connect();
  console.log('Connected to PostgreSQL');

  const tables = [
    'users',
    'user_profiles',
    'stories',
    'characters',
    'worlds',
    'chat_sessions',
    'chat_messages',
    'snapshots',
    'likes',
    'follows',
    'notifications',
  ];

  for (const table of tables) {
    console.log(`Migrating ${table}...`);

    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();

    if (rows.length === 0) {
      console.log(`  No rows in ${table}, skipping`);
      continue;
    }

    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      if (batch.length > 0) {
        const columns = Object.keys(batch[0]);
        const values = batch.map(row =>
          columns.map(col => {
            const val = (row as any)[col];
            if (val === null || val === undefined) return null;
            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
              return new Date(val);
            }
            return val;
          })
        );

        const placeholders = values.map((_, idx) =>
          `(${columns.map((_, cidx) => `$${idx * columns.length + cidx + 1}`).join(', ')})`
        ).join(', ');

        const query = `
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES ${placeholders}
          ON CONFLICT (id) DO UPDATE SET
          ${columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}
        `;

        try {
          await pg.query(query, values.flat());
          console.log(`  Migrated ${batch.length} rows`);
        } catch (error) {
          console.error(`  Error migrating ${table}:`, error);
        }
      }
    }
  }

  console.log('Migration completed');
  await pg.end();
  sqlite.close();
}

migrate().catch(console.error);
```

### 5. 执行迁移

```bash
# 设置密码
export PG_PASSWORD='your_password'

# 执行迁移
npx ts-node scripts/migrate-to-postgres.ts
```

## 迁移后优化

### PostgreSQL 特定优化

```sql
-- 分析表以更新统计信息
ANALYZE;

-- 重新构建索引
REINDEX DATABASE storyforge;

-- 更新视图（如果有）
REFRESH MATERIALIZED VIEW metrics_daily;
```

### 连接池配置

```typescript
// lib/db-pg.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: 'storyforge',
  user: 'storyforge_user',
  password: process.env.PG_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query<T>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}
```

## 回滚计划

如果迁移失败：

1. **立即停止双写**
2. **切换回 SQLite**
3. **调查问题原因**
4. **修复后重新迁移**

```typescript
// 回滚示例
async function rollbackToSQLite() {
  // 停止 PostgreSQL 写入
  process.env.USE_POSTGRES = 'false';

  // 清理 PostgreSQL 数据（可选）
  // await pg.query('DROP DATABASE storyforge');

  // 继续使用 SQLite
  console.log('Rolled back to SQLite');
}
```

## 监控指标

迁移后监控以下指标：

| 指标 | 目标值 |
|------|--------|
| 查询延迟 P50 | < 50ms |
| 查询延迟 P95 | < 200ms |
| 写入延迟 P95 | < 100ms |
| 连接池使用率 | < 80% |
| 错误率 | < 0.1% |

## 注意事项

1. **时间戳处理**：SQLite 使用字符串，PostgreSQL 使用 `TIMESTAMP WITH TIME ZONE`
2. **JSON 字段**：PostgreSQL 原生支持 JSON，改用 `jsonb` 提升性能
3. **全文搜索**：PostgreSQL 使用 `tsvector` 和 `tsquery`
4. **数组字段**：PostgreSQL 原生支持数组类型
5. **外键约束**：确保引用完整性
