import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'
import trayNormalIcon from '../../resources/tray-normal.png?asset'
import trayMarkedIcon from '../../resources/tray-marked.png?asset'

import { closeDatabase, getDatabase } from './db'
import { notifyTimelineUpdated, registerTimelineIpc } from './ipc'
import { registerTimelineShortcut, unregisterTimelineShortcut } from './shortcut'
import { createTimelineService, type TimelineDatabase } from './timeline-service'
import { setupTray } from './tray'

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal')
}

let mainWindow: BrowserWindow | null = null
let trayInstance: { destroy: () => void; triggerFeedback: () => void } | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      // preload 是渲染进程访问主进程能力的唯一安全入口。
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.on('close', (event) => {
    // 除非用户显式从托盘菜单点击“退出”，否则拦截关闭按钮并隐藏到后台托盘。
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })

  window.webContents.setWindowOpenHandler((details) => {
    // 外部链接交给系统浏览器，避免在 Electron 窗口里打开未知页面。
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发模式加载 Vite dev server；生产模式加载构建后的 renderer 文件。
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

void app
  .whenReady()
  .then(() => {
    electronApp.setAppUserModelId('com.timeline-journal')

    app.on('browser-window-created', (_, window) => {
      // 开发期保留常用快捷键，生产期阻止刷新等会破坏桌面体验的操作。
      optimizer.watchWindowShortcuts(window)
    })

    // 先初始化数据库并创建服务，再创建窗口；后续 IPC 与快捷键直接复用该服务实例。
    const database = getDatabase() as unknown as TimelineDatabase
    const timelineService = createTimelineService({
      database,
      onUpdated: () => {
        notifyTimelineUpdated()
        trayInstance?.triggerFeedback()
      }
    })

    registerTimelineIpc(timelineService)
    registerTimelineShortcut(timelineService)
    mainWindow = createWindow()

    trayInstance = setupTray({
      mainWindow,
      timelineService,
      normalIconPath: trayNormalIcon,
      markedIconPath: trayMarkedIcon
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      } else {
        mainWindow?.show()
      }
    })
  })
  .catch((error: unknown) => {
    console.error('Failed to start Electron main process.', error)
    app.quit()
  })

app.on('before-quit', () => {
  isQuitting = true
  trayInstance?.destroy()
  trayInstance = null
  closeDatabase()
})

app.on('will-quit', () => {
  unregisterTimelineShortcut()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
