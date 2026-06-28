import { ipcMain } from 'electron'

import { getTodaySegments, markNow } from './timeline'

export const timelineIpcChannels = {
  markNow: 'timeline:mark-now',
  getTodaySegments: 'timeline:get-today-segments'
} as const

export function registerTimelineIpc(): void {
  // 注册前先移除旧 handler，让开发期热重启或重复初始化更可控。
  ipcMain.removeHandler(timelineIpcChannels.markNow)
  ipcMain.removeHandler(timelineIpcChannels.getTodaySegments)

  ipcMain.handle(timelineIpcChannels.markNow, () => markNow('renderer'))
  ipcMain.handle(timelineIpcChannels.getTodaySegments, () => getTodaySegments())
}
