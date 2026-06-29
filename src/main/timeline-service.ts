import { randomUUID } from 'crypto'

import type { TimeMarkerSource, TimeSegment, TimeSegmentStatus } from '../shared/timeline'

export interface TimelineStatement<Result = unknown> {
  run: (params?: object) => unknown
  get: (params?: object) => Result | undefined
  all: (params?: object) => Result[]
}

export interface TimelineDatabase {
  prepare: <Result = unknown>(source: string) => TimelineStatement<Result>
  transaction: <Result>(fn: () => Result) => () => Result
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

interface TodayBounds {
  startOfDay: string
  endOfDay: string
}

export interface TimelineService {
  markNow: (source: TimeMarkerSource) => TimeSegment[]
  getTodaySegments: () => TimeSegment[]
  updateSegmentTitle: (id: string, title: string) => TimeSegment[]
}

export interface TimelineServiceOptions {
  database: TimelineDatabase
  now?: () => Date
  onUpdated?: () => void
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

function getSegmentsForDay(database: TimelineDatabase, date: Date): TimeSegment[] {
  const bounds = getLocalDayBounds(date)
  const rows = database
    .prepare<TimeSegmentRow>(
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

export function createTimelineService(options: TimelineServiceOptions): TimelineService {
  const { database, now = () => new Date(), onUpdated } = options

  return {
    getTodaySegments: () => getSegmentsForDay(database, now()),
    markNow: (source: TimeMarkerSource): TimeSegment[] => {
      const currentTime = now()
      const nowIso = currentTime.toISOString()

      // better-sqlite3 的命名参数会根据这些 TypeScript 类型检查调用方传参。
      const insertMarker = database.prepare(`
        INSERT INTO time_markers (id, timestamp, source, created_at)
        VALUES (@id, @timestamp, @source, @createdAt)
      `)

      const findActiveSegment = database.prepare<ActiveSegmentRow>(`
        SELECT id
        FROM time_segments
        WHERE end_time IS NULL
        ORDER BY start_time DESC, created_at DESC
        LIMIT 1
      `)

      const closeActiveSegment = database.prepare(`
        UPDATE time_segments
        SET end_time = @endTime,
            status = 'pending',
            updated_at = @updatedAt
        WHERE id = @id
      `)

      const insertSegment = database.prepare(`
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

        return getSegmentsForDay(database, currentTime)
      })

      const result = runMarkNow()
      onUpdated?.()
      return result
    },
    updateSegmentTitle: (id: string, title: string): TimeSegment[] => {
      const currentTime = now()
      const nowIso = currentTime.toISOString()

      const findSegment = database.prepare<{ end_time: string | null }>(`
        SELECT end_time
        FROM time_segments
        WHERE id = @id
        LIMIT 1
      `)

      const updateTitleStmt = database.prepare(`
        UPDATE time_segments
        SET title = @title,
            status = @status,
            updated_at = @updatedAt
        WHERE id = @id
      `)

      const runUpdate = database.transaction((): TimeSegment[] => {
        const existing = findSegment.get({ id })
        if (!existing) {
          return getSegmentsForDay(database, currentTime)
        }

        const nextTitle = title.trim()
        const isDefaultTitle = nextTitle === defaultSegmentTitle || nextTitle === ''
        const finalTitle = nextTitle === '' ? defaultSegmentTitle : nextTitle
        const nextStatus = isDefaultTitle
          ? existing.end_time === null
            ? 'active'
            : 'pending'
          : 'edited'

        updateTitleStmt.run({
          id,
          title: finalTitle,
          status: nextStatus,
          updatedAt: nowIso
        })

        return getSegmentsForDay(database, currentTime)
      })

      const result = runUpdate()
      onUpdated?.()
      return result
    }
  }
}
