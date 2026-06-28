import { contextBridge, ipcRenderer } from 'electron'

import type { TimelineApi } from '../shared/timeline'

const timelineIpcChannels = {
  markNow: 'timeline:mark-now',
  getTodaySegments: 'timeline:get-today-segments'
} as const

export const timelineAPI: TimelineApi = {
  markNow: () => ipcRenderer.invoke(timelineIpcChannels.markNow),
  getTodaySegments: () => ipcRenderer.invoke(timelineIpcChannels.getTodaySegments)
}

export function exposeTimelineApi(): void {
  // 只暴露明确的业务方法，不把 ipcRenderer 直接交给渲染进程。
  contextBridge.exposeInMainWorld('timelineAPI', timelineAPI)
}
