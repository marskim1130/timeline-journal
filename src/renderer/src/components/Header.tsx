interface HeaderProperties {
  todayLabel: string
  segmentCount: number
  isLoading: boolean
  onMarkNow: () => void
  onRefresh: () => void
}

function Header({
  todayLabel,
  segmentCount,
  isLoading,
  onMarkNow,
  onRefresh
}: HeaderProperties): React.JSX.Element {
  return (
    <header className="app-header">
      <div className="title-group">
        <h1>Timeline Journal</h1>
        <div className="header-meta">
          <span>{todayLabel}</span>
          <span>{segmentCount} 个时间段</span>
        </div>
      </div>

      <div className="toolbar">
        <button className="primary-button" disabled={isLoading} onClick={onMarkNow} type="button">
          标记此刻
        </button>
        <button className="secondary-button" disabled={isLoading} onClick={onRefresh} type="button">
          刷新
        </button>
      </div>
    </header>
  )
}

export default Header
