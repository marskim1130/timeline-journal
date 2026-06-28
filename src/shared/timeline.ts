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

export interface TimelineApi {
  markNow: () => Promise<TimeSegment[]>
  getTodaySegments: () => Promise<TimeSegment[]>
}
