import { BrowserWindow, ipcMain } from 'electron'

import type { TimelineService } from './timeline-service'

export const timelineIpcChannels = {
  markNow: 'timeline:mark-now',
  getTodaySegments: 'timeline:get-today-segments',
  updated: 'timeline:updated'
} as const

export function notifyTimelineUpdated(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(timelineIpcChannels.updated)
    }
  }
}

export function registerTimelineIpc(service: TimelineService): void {
  // 注册前先移除旧 handler，让开发期热重启或重复初始化更可控。
  ipcMain.removeHandler(timelineIpcChannels.markNow)
  ipcMain.removeHandler(timelineIpcChannels.getTodaySegments)

  ipcMain.handle(timelineIpcChannels.markNow, () => service.markNow('renderer'))
  ipcMain.handle(timelineIpcChannels.getTodaySegments, () => service.getTodaySegments())
}
