import type { TimeMarkerSource, TimeSegment } from '../shared/timeline'
import { getDatabase } from './db'
import { createTimelineService, type TimelineDatabase } from './timeline-service'

// Marker 是用户按下“标记此刻”的原始事件；Segment 是由相邻 marker 推导出的时间段。
export type { TimeMarkerSource, TimeSegment, TimeSegmentStatus } from '../shared/timeline'

function getTimelineDatabase(): TimelineDatabase {
  // better-sqlite3 的类型签名比服务层端口更具体；运行时方法形状兼容。
  return getDatabase() as unknown as TimelineDatabase
}

export function getTodaySegments(): TimeSegment[] {
  return createTimelineService({ database: getTimelineDatabase() }).getTodaySegments()
}

export function markNow(source: TimeMarkerSource): TimeSegment[] {
  return createTimelineService({ database: getTimelineDatabase() }).markNow(source)
}
