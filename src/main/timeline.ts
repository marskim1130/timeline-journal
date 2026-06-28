import { randomUUID } from 'crypto'

import { getDatabase } from './db'

// Marker 是用户按下“标记此刻”的原始事件；Segment 是由相邻 marker 推导出的时间段。
export type TimeMarkerSource = 'hotkey' | 'tray' | 'renderer'
export type TimeSegmentStatus = 'active' | 'pending' | 'edited'

export interface TimeSegment {
  id: string
  startTime: string
  endTime: string | null
  title: string
  status: TimeSegmentStatus
  createdAt: string
  updatedAt: string
}

interface TimeSegmentRow {
  id: string
  start_time: string
  end_time: string | null
  title: string
  status: string
  created_at: string
  updated_at: string
}

interface ActiveSegmentRow {
  id: string
}

interface InsertMarkerParams {
  id: string
  timestamp: string
  source: TimeMarkerSource
  createdAt: string
}

interface CloseSegmentParams {
  id: string
  endTime: string
  updatedAt: string
}

interface InsertSegmentParams {
  id: string
  startTime: string
  title: string
  status: TimeSegmentStatus
  createdAt: string
  updatedAt: string
}

interface TodayBounds {
  startOfDay: string
  endOfDay: string
}

const defaultSegmentTitle = '待整理'

function getLocalDayBounds(date: Date): TodayBounds {
  // “今日”按用户本机时区计算，再转成 ISO 字符串与数据库中的 UTC 时间比较。
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

  return {
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString()
  }
}

function toTimeSegmentStatus(status: string): TimeSegmentStatus {
  // 数据库中的历史值如果不认识，降级为 pending，避免把坏数据扩散到 UI。
  if (status === 'active' || status === 'pending' || status === 'edited') {
    return status
  }

  return 'pending'
}

function toTimeSegment(row: TimeSegmentRow): TimeSegment {
  return {
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    status: toTimeSegmentStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function getSegmentsForDay(date: Date): TimeSegment[] {
  const database = getDatabase()
  const bounds = getLocalDayBounds(date)
  const rows = database
    .prepare<TodayBounds, TimeSegmentRow>(
      `
        SELECT id, start_time, end_time, title, status, created_at, updated_at
        FROM time_segments
        -- 跨天时间段也属于今天：只要与今天的时间窗口有交集就返回。
        WHERE start_time < @endOfDay
          AND (end_time IS NULL OR end_time >= @startOfDay)
        ORDER BY start_time ASC, created_at ASC
      `
    )
    .all(bounds)

  return rows.map(toTimeSegment)
}

export function getTodaySegments(): TimeSegment[] {
  return getSegmentsForDay(new Date())
}

export function markNow(source: TimeMarkerSource): TimeSegment[] {
  const database = getDatabase()
  const now = new Date()
  const nowIso = now.toISOString()

  // better-sqlite3 的命名参数会根据这些 TypeScript 类型检查调用方传参。
  const insertMarker = database.prepare<InsertMarkerParams>(`
    INSERT INTO time_markers (id, timestamp, source, created_at)
    VALUES (@id, @timestamp, @source, @createdAt)
  `)

  const findActiveSegment = database.prepare<[], ActiveSegmentRow>(`
    SELECT id
    FROM time_segments
    WHERE end_time IS NULL
    ORDER BY start_time DESC, created_at DESC
    LIMIT 1
  `)

  const closeActiveSegment = database.prepare<CloseSegmentParams>(`
    UPDATE time_segments
    SET end_time = @endTime,
        status = 'pending',
        updated_at = @updatedAt
    WHERE id = @id
  `)

  const insertSegment = database.prepare<InsertSegmentParams>(`
    INSERT INTO time_segments (
      id,
      start_time,
      end_time,
      title,
      status,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @startTime,
      NULL,
      @title,
      @status,
      @createdAt,
      @updatedAt
    )
  `)

  // 一次 markNow 必须原子完成：写 marker、关闭旧 segment、创建新 active segment。
  const runMarkNow = database.transaction((): TimeSegment[] => {
    insertMarker.run({
      id: randomUUID(),
      timestamp: nowIso,
      source,
      createdAt: nowIso
    })

    const activeSegment = findActiveSegment.get()

    if (activeSegment) {
      closeActiveSegment.run({
        id: activeSegment.id,
        endTime: nowIso,
        updatedAt: nowIso
      })
    }

    insertSegment.run({
      id: randomUUID(),
      startTime: nowIso,
      title: defaultSegmentTitle,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso
    })

    return getSegmentsForDay(now)
  })

  return runMarkNow()
}
