import { useCallback, useEffect, useState } from 'react'

import type { TimeSegment } from '../../shared/timeline'

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

  useEffect(() => {
    void loadTodaySegments()
  }, [loadTodaySegments])

  return (
    <main className="debug-shell">
      <header className="debug-header">
        <div>
          <p className="eyebrow">Timeline Journal</p>
          <h1>IPC Debug</h1>
        </div>
        <div className="debug-actions">
          <button disabled={isLoading} onClick={markNow} type="button">
            Mark Now
          </button>
          <button disabled={isLoading} onClick={loadTodaySegments} type="button">
            Refresh
          </button>
        </div>
      </header>

      {errorMessage ? <p className="error-message">{errorMessage}</p> : null}

      <section className="segments-panel">
        <div className="segments-summary">
          <span>Today Segments</span>
          <strong>{segments.length}</strong>
        </div>

        {segments.length > 0 ? (
          <ol className="segment-list">
            {segments.map((segment) => (
              <li key={segment.id} className="segment-item">
                <span>{segment.startTime}</span>
                <span>{segment.endTime ?? 'active'}</span>
                <span>{segment.status}</span>
                <span>{segment.title}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">{isLoading ? 'Loading...' : 'No segments yet'}</p>
        )}

        <pre className="json-preview">{JSON.stringify(segments, null, 2)}</pre>
      </section>
    </main>
  )
}

export default App
