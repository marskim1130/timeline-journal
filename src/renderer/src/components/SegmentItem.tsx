import { useEffect, useRef, useState } from 'react'
import type { TimeSegment } from '../../../shared/timeline'

interface SegmentItemProperties {
  segment: TimeSegment
  onUpdateTitle?: (id: string, title: string) => Promise<void>
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

function formatTime(timestamp: string): string {
  return timeFormatter.format(new Date(timestamp))
}

function formatDuration(startTime: string, endTime: string | null): string {
  if (!endTime) {
    return '进行中'
  }

  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} 分钟`
  }

  if (minutes === 0) {
    return `${hours} 小时`
  }

  return `${hours} 小时 ${minutes} 分钟`
}

function getStatusLabel(status: TimeSegment['status']): string {
  if (status === 'active') {
    return '进行中'
  }

  if (status === 'edited') {
    return '已整理'
  }

  return '待整理'
}

function SegmentItem({ segment, onUpdateTitle }: SegmentItemProperties): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [titleInput, setTitleInput] = useState(segment.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const endLabel = segment.endTime ? formatTime(segment.endTime) : '现在'

  useEffect(() => {
    setTitleInput(segment.title)
  }, [segment.title])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleSave = async (): Promise<void> => {
    setIsEditing(false)
    if (onUpdateTitle && titleInput.trim() !== segment.title) {
      await onUpdateTitle(segment.id, titleInput.trim())
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      void handleSave()
    } else if (event.key === 'Escape') {
      setTitleInput(segment.title)
      setIsEditing(false)
    }
  }

  return (
    <li className="segment-row">
      <div className="time-range">
        <span>{formatTime(segment.startTime)}</span>
        <span className="time-divider">-</span>
        <span>{endLabel}</span>
      </div>
      <div className="duration-label">{formatDuration(segment.startTime, segment.endTime)}</div>
      <div className={`status-pill status-${segment.status}`}>{getStatusLabel(segment.status)}</div>
      <div className="segment-title-container">
        {isEditing ? (
          <input
            ref={inputRef}
            className="title-edit-input"
            onBlur={() => void handleSave()}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            type="text"
            value={titleInput}
          />
        ) : (
          <span className="segment-title" onClick={() => setIsEditing(true)} title="点击修改标题">
            {segment.title}
          </span>
        )}
      </div>
    </li>
  )
}

export default SegmentItem
