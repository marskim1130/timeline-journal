import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '@electron-toolkit/preload'

type ExposedWindow = Window &
  typeof globalThis & {
    electron: ElectronAPI
    api: Record<string, never>
  }

const api: Record<string, never> = {}

if (process.contextIsolated) {
  try {
    // contextBridge 只暴露受控对象，不把 ipcRenderer 等高权限对象直接交给页面。
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // 兼容关闭上下文隔离的开发场景；生产应保持 contextIsolation 开启。
  const exposedWindow = window as ExposedWindow
  exposedWindow.electron = electronAPI
  exposedWindow.api = api
}
