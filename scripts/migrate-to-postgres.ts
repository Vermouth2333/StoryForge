/* eslint-disable @typescript-eslint/no-explicit-any -- 迁移脚本处理动态数据库行，使用 any 映射任意表结构 */
import dotenv from 'dotenv';

dotenv.config();

const sqlitePath = './storyforge.db';
const pgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'storyforge',
  user: process.env.PG_USER || 'storyforge_user',
  password: process.env.PG_PASSWORD,
};

async function migrateTable(
  sqlite: any,
  pg: any,
  tableName: string,
  batchSize: number = 1000
) {
  console.log(`Migrating table: ${tableName}`);

  const result = {
    table: tableName,
    totalRows: 0,
    migratedRows: 0,
    failedRows: 0,
    error: undefined as string | undefined,
  };

  try {
    const countResult = sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    result.totalRows = countResult.count || 0;

    if (result.totalRows === 0) {
      console.log(`  No rows in ${tableName}, skipping`);
      return result;
    }

    const columnsResult = sqlite.prepare(
      `PRAGMA table_info(${tableName})`
    ).all();
    const columns = columnsResult.map((c: { name: string }) => c.name);

    let offset = 0;
    while (offset < result.totalRows) {
      const rows = sqlite
        .prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`)
        .all(batchSize, offset);

      if (rows.length === 0) break;

      const values = rows.map((row: Record<string, any>) =>
        columns.map((col: string) => {
          const val = row[col];
          if (val === null || val === undefined) return null;
          if (typeof val === 'string') {
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(val)) {
              return new Date(val);
            }
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(val)) {
              return new Date(val.replace(' ', 'T'));
            }
          }
          return val;
        })
      );

      const placeholders = values
        .map((_: any, idx: number) =>
          `(${columns.map((__: any, cidx: number) => `$${idx * columns.length + cidx + 1}`).join(', ')})`
        )
        .join(', ');

      const query = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (id) DO UPDATE SET
        ${columns.map((col: string) => `${col} = EXCLUDED.${col}`).join(', ')}
      `;

      try {
        await pg.query(query, values.flat());
        result.migratedRows += rows.length;
        console.log(`  Migrated ${result.migratedRows}/${result.totalRows} rows`);
      } catch (error: any) {
        console.error(`  Error migrating batch:`, error);
        result.failedRows += rows.length;
      }

      offset += batchSize;
    }

    console.log(`  Completed: ${result.migratedRows} migrated, ${result.failedRows} failed`);
  } catch (error: any) {
    console.error(`  Migration error:`, error);
    result.error = error.message;
  }

  return result;
}

async function main() {
  console.log('Starting SQLite to PostgreSQL migration...');

  const { default: Database } = await import('better-sqlite3');
  const { Client } = await import('pg');

  const sqlite = new Database(sqlitePath);
  console.log('Connected to SQLite');

  const pg = new Client(pgConfig);
  await pg.connect();
  console.log('Connected to PostgreSQL');

  const tables = [
    'users',
    'user_profiles',
    'stories',
    'characters',
    'worlds',
    'chapters',
    'chat_sessions',
    'chat_messages',
    'snapshots',
    'likes',
    'favorites',
    'follows',
    'notifications',
    'comments',
    'comment_reports',
    'story_branches',
    'story_style_anchors',
    'conflict_detection_logs',
    'consistency_check_logs',
    'derivative_relations',
    'assets',
  ];

  const results: any[] = [];
  const batchSize = parseInt(process.env.BATCH_SIZE || '1000');

  for (const table of tables) {
    const result = await migrateTable(sqlite, pg, table, batchSize);
    results.push(result);
  }

  await pg.end();
  sqlite.close();

  console.log('\n=== Migration Summary ===');
  const totalRows = results.reduce((sum: number, r: any) => sum + r.totalRows, 0);
  const migratedRows = results.reduce((sum: number, r: any) => sum + r.migratedRows, 0);
  const failedRows = results.reduce((sum: number, r: any) => sum + r.failedRows, 0);

  console.log(`Total rows: ${totalRows}`);
  console.log(`Migrated: ${migratedRows}`);
  console.log(`Failed: ${failedRows}`);

  const failedTables = results.filter((r: any) => r.failedRows > 0 || r.error);
  if (failedTables.length > 0) {
    console.log('\nFailed tables:');
    failedTables.forEach((r: any) => {
      console.log(`  ${r.table}: ${r.error || `${r.failedRows} rows failed`}`);
    });
    process.exit(1);
  } else {
    console.log('\nMigration completed successfully!');
    process.exit(0);
  }
}

main().catch((error: any) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
