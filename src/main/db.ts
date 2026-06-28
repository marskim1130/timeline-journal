import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'

export type DatabaseConnection = InstanceType<typeof Database>

const databaseFileName = 'timeline-journal.db'

let database: DatabaseConnection | null = null

export function getDatabasePath(): string {
  // 数据库放在 Electron 的用户数据目录，避免写入项目目录或安装目录。
  return join(app.getPath('userData'), databaseFileName)
}

export function initializeDatabase(): DatabaseConnection {
  if (database?.open) {
    return database
  }

  const databasePath = getDatabasePath()
  mkdirSync(dirname(databasePath), { recursive: true })

  const connection = new Database(databasePath)
  // WAL 让桌面应用的读写更平滑；外键开关为后续表关系预留安全边界。
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  // 表结构在启动时幂等创建，重启应用不会覆盖已有数据。
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

  database = connection
  return connection
}

export function getDatabase(): DatabaseConnection {
  if (database?.open) {
    return database
  }

  // 调用方不需要关心数据库是否已经初始化。
  return initializeDatabase()
}

export function closeDatabase(): void {
  if (database?.open) {
    database.close()
  }

  database = null
}
