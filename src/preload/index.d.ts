import { ElectronAPI } from '@electron-toolkit/preload'

import type { TimelineApi } from '../shared/timeline'

declare global {
  interface Window {
    // 必须与 preload 中 exposeInMainWorld 暴露的对象保持一致。
    electron: ElectronAPI
    api: Record<string, never>
    timelineAPI: TimelineApi
  }
}
