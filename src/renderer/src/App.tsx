import { useCallback, useEffect, useState } from 'react'

import type { TimeSegment } from '../../shared/timeline'
import Header from './components/Header'
import TodaySegmentList from './components/TodaySegmentList'

const todayFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

function App(): React.JSX.Element {
  const [segments, setSegments] = useState<TimeSegment[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadTodaySegments = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const nextSegments = await window.timelineAPI.getTodaySegments()
      setSegments(nextSegments)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const markNow = async (): Promise<void> => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const nextSegments = await window.timelineAPI.markNow()
      setSegments(nextSegments)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }

  const updateSegmentTitle = async (id: string, title: string): Promise<void> => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const nextSegments = await window.timelineAPI.updateSegmentTitle(id, title)
      setSegments(nextSegments)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTodaySegments()
  }, [loadTodaySegments])

  useEffect(() => {
    return window.timelineAPI.onTimelineUpdated(() => {
      void loadTodaySegments()
    })
  }, [loadTodaySegments])

  return (
    <main className="app-shell">
      <Header
        isLoading={isLoading}
        onMarkNow={markNow}
        onRefresh={loadTodaySegments}
        segmentCount={segments.length}
        todayLabel={todayFormatter.format(new Date())}
      />

      {errorMessage ? <p className="error-message">{errorMessage}</p> : null}

      <TodaySegmentList
        isLoading={isLoading}
        onUpdateTitle={updateSegmentTitle}
        segments={segments}
      />
    </main>
  )
}

export default App
