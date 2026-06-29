import { beforeEach, describe, expect, it } from 'vite-plus/test'

import {
  createTimelineService,
  type TimelineDatabase,
  type TimelineService,
  type TimelineStatement
} from './timeline-service'

interface SegmentRecord {
  id: string
  start_time: string
  end_time: string | null
  title: string
  status: string
  created_at: string
  updated_at: string
}

interface MarkerRecord {
  id: string
  timestamp: string
  source: string
  created_at: string
}

interface InsertMarkerParams {
  id: string
  timestamp: string
  source: string
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
  status: string
  createdAt: string
  updatedAt: string
}

interface DayBounds {
  startOfDay: string
  endOfDay: string
}

class FakeTimelineDatabase implements TimelineDatabase {
  readonly markers: MarkerRecord[] = []
  readonly segments: SegmentRecord[] = []

  prepare<Result = unknown>(source: string): TimelineStatement<Result> {
    if (source.includes('INSERT INTO time_markers')) {
      return {
        run: (params?: object): void => {
          const marker = params as InsertMarkerParams
          this.markers.push({
            id: marker.id,
            timestamp: marker.timestamp,
            source: marker.source,
            created_at: marker.createdAt
          })
        },
        get: (): Result | undefined => undefined,
        all: (): Result[] => []
      }
    }

    if (source.includes('WHERE end_time IS NULL') && source.includes('LIMIT 1')) {
      return {
        run: (): void => {},
        get: (): Result | undefined => {
          const activeSegment = [...this.segments]
            .filter((segment) => segment.end_time === null)
            .sort((left, right) => right.start_time.localeCompare(left.start_time))[0]

          return activeSegment ? ({ id: activeSegment.id } as Result) : undefined
        },
        all: (): Result[] => []
      }
    }

    if (source.includes('UPDATE time_segments') && source.includes('SET title =')) {
      return {
        run: (params?: object): void => {
          const update = params as { id: string; title: string; status: string; updatedAt: string }
          const segment = this.segments.find((candidate) => candidate.id === update.id)

          if (segment) {
            segment.title = update.title
            segment.status = update.status
            segment.updated_at = update.updatedAt
          }
        },
        get: (): Result | undefined => undefined,
        all: (): Result[] => []
      }
    }

    if (source.includes('UPDATE time_segments')) {
      return {
        run: (params?: object): void => {
          const update = params as CloseSegmentParams
          const segment = this.segments.find((candidate) => candidate.id === update.id)

          if (segment) {
            segment.end_time = update.endTime
            segment.status = 'pending'
            segment.updated_at = update.updatedAt
          }
        },
        get: (): Result | undefined => undefined,
        all: (): Result[] => []
      }
    }

    if (source.includes('INSERT INTO time_segments')) {
      return {
        run: (params?: object): void => {
          const segment = params as InsertSegmentParams
          this.segments.push({
            id: segment.id,
            start_time: segment.startTime,
            end_time: null,
            title: segment.title,
            status: segment.status,
            created_at: segment.createdAt,
            updated_at: segment.updatedAt
          })
        },
        get: (): Result | undefined => undefined,
        all: (): Result[] => []
      }
    }

    if (source.includes('SELECT end_time') && source.includes('WHERE id = @id')) {
      return {
        run: (): void => {},
        get: (params?: object): Result | undefined => {
          const { id } = params as { id: string }
          const segment = this.segments.find((candidate) => candidate.id === id)
          return segment ? ({ end_time: segment.end_time } as Result) : undefined
        },
        all: (): Result[] => []
      }
    }

    if (source.includes('FROM time_segments')) {
      return {
        run: (): void => {},
        get: (): Result | undefined => undefined,
        all: (params?: object): Result[] => {
          const bounds = params as DayBounds

          return this.segments
            .filter(
              (segment) =>
                segment.start_time < bounds.endOfDay &&
                (segment.end_time === null || segment.end_time >= bounds.startOfDay)
            )
            .sort((left, right) => left.start_time.localeCompare(right.start_time))
            .map((segment) => ({ ...segment }) as Result)
        }
      }
    }

    throw new Error(`Unexpected SQL in fake database: ${source}`)
  }

  transaction<Result>(fn: () => Result): () => Result {
    return fn
  }
}

let database: FakeTimelineDatabase
let service: TimelineService
let clockIndex: number

const markTimes = [new Date('2026-06-28T01:00:00.000Z'), new Date('2026-06-28T02:20:00.000Z')]

function nextClockTime(): Date {
  const currentTime = markTimes[clockIndex] ?? markTimes[markTimes.length - 1]
  clockIndex += 1
  return currentTime
}

beforeEach(() => {
  database = new FakeTimelineDatabase()
  clockIndex = 0
  service = createTimelineService({
    database,
    now: nextClockTime
  })
})

describe('createTimelineService', () => {
  it('closes the previous active segment and creates a new active segment', () => {
    const firstSegments = service.markNow('renderer')

    expect(firstSegments).toHaveLength(1)
    expect(firstSegments[0]).toMatchObject({
      startTime: markTimes[0].toISOString(),
      endTime: null,
      title: '待整理',
      status: 'active'
    })

    const secondSegments = service.markNow('renderer')

    expect(secondSegments).toHaveLength(2)
    expect(secondSegments[0]).toMatchObject({
      startTime: markTimes[0].toISOString(),
      endTime: markTimes[1].toISOString(),
      title: '待整理',
      status: 'pending'
    })
    expect(secondSegments[1]).toMatchObject({
      startTime: markTimes[1].toISOString(),
      endTime: null,
      title: '待整理',
      status: 'active'
    })

    expect(database.markers).toHaveLength(2)
    expect(database.markers.map((marker) => marker.source)).toEqual(['renderer', 'renderer'])
  })

  it('triggers onUpdated callback when markNow is called', () => {
    let callCount = 0
    const testService = createTimelineService({
      database,
      now: nextClockTime,
      onUpdated: () => {
        callCount += 1
      }
    })

    testService.markNow('hotkey')
    expect(callCount).toBe(1)

    testService.markNow('renderer')
    expect(callCount).toBe(2)
  })

  it('updates segment title and sets status to edited if not 待整理', () => {
    let callCount = 0
    const testService = createTimelineService({
      database,
      now: nextClockTime,
      onUpdated: () => {
        callCount += 1
      }
    })

    const initialSegments = testService.markNow('renderer')
    const targetId = initialSegments[0].id

    const updatedSegments = testService.updateSegmentTitle(targetId, '深入架构测试')

    expect(updatedSegments[0]).toMatchObject({
      id: targetId,
      title: '深入架构测试',
      status: 'edited'
    })
    expect(callCount).toBe(2) // 1 from markNow, 1 from updateSegmentTitle
  })
})
