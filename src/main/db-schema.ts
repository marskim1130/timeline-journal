import type Database from 'better-sqlite3'

type DatabaseConnection = InstanceType<typeof Database>

export function applyTimelineSchema(connection: DatabaseConnection): void {
  // 表结构在启动和测试时都幂等创建，确保运行时代码与测试使用同一份 schema。
  connection.exec(`
    CREATE TABLE IF NOT EXISTS time_markers (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_segments (
      id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT,
      title TEXT NOT NULL DEFAULT '待整理',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}
