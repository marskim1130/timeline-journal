import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'
import { closeDatabase, initializeDatabase } from './db'
import { registerTimelineIpc } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // 外部链接交给系统浏览器，避免在 Electron 窗口里打开未知页面。
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发模式加载 Vite dev server；生产模式加载构建后的 renderer 文件。
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app
  .whenReady()
  .then(() => {
    electronApp.setAppUserModelId('com.timeline-journal')

    app.on('browser-window-created', (_, window) => {
      // 开发期保留常用快捷键，生产期阻止刷新等会破坏桌面体验的操作。
      optimizer.watchWindowShortcuts(window)
    })

    // 先初始化数据库，再创建窗口；后续 IPC 可以假设数据库已经可用。
    initializeDatabase()
    registerTimelineIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
  .catch((error: unknown) => {
    console.error('Failed to start Electron main process.', error)
    app.quit()
  })

app.on('before-quit', () => {
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
