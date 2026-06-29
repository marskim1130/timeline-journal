import type { TimeSegment } from '../../../shared/timeline'
import SegmentItem from './SegmentItem'

interface TodaySegmentListProperties {
  segments: TimeSegment[]
  isLoading: boolean
  onUpdateTitle?: (id: string, title: string) => Promise<void>
}

function TodaySegmentList({
  segments,
  isLoading,
  onUpdateTitle
}: TodaySegmentListProperties): React.JSX.Element {
  if (segments.length === 0) {
    return (
      <section className="timeline-panel">
        <div className="timeline-panel-header">
          <span>今日时间线</span>
        </div>
        <p className="empty-state">{isLoading ? '加载中...' : '今天还没有时间段'}</p>
      </section>
    )
  }

  return (
    <section className="timeline-panel">
      <div className="timeline-panel-header timeline-grid">
        <span>时间</span>
        <span>持续</span>
        <span>状态</span>
        <span>标题</span>
      </div>

      <ol className="segment-list">
        {segments.map((segment) => (
          <SegmentItem key={segment.id} onUpdateTitle={onUpdateTitle} segment={segment} />
        ))}
      </ol>
    </section>
  )
}

export default TodaySegmentList
