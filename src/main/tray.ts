import type { BrowserWindow, Menu } from 'electron'

export interface TrayAdapter {
  setImage(imagePath: string): void
  setContextMenu(menu: Menu): void
  setToolTip(toolTip: string): void
  onLeftClick(callback: () => void): void
}

export interface TrayManagerOptions {
  adapter: TrayAdapter
  normalIconPath: string
  markedIconPath: string
}

export class TrayManager {
  private adapter: TrayAdapter
  private normalIconPath: string
  private markedIconPath: string
  private timer: NodeJS.Timeout | null = null

  constructor(options: TrayManagerOptions) {
    this.adapter = options.adapter
    this.normalIconPath = options.normalIconPath
    this.markedIconPath = options.markedIconPath

    this.adapter.setImage(this.normalIconPath)
  }

  public triggerFeedback(): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.adapter.setImage(this.markedIconPath)

    this.timer = setTimeout(() => {
      this.adapter.setImage(this.normalIconPath)
      this.timer = null
    }, 500)
  }

  public destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

export interface WindowAdapter {
  isVisible(): boolean
  isMinimized(): boolean
  show(): void
  hide(): void
  focus(): void
  restore(): void
}

export function toggleWindowVisibility(window: WindowAdapter): void {
  if (window.isVisible() && !window.isMinimized()) {
    window.hide()
  } else {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
}

export interface WindowToggleState {
  /** 上一次通过托盘切换操作后的预期可见状态 */
  visible: boolean
}

export function createWindowToggler(window: WindowAdapter): {
  toggle: () => void
  markShown: () => void
  getState: () => WindowToggleState
} {
  const state: WindowToggleState = { visible: true }

  return {
    toggle() {
      if (state.visible) {
        window.hide()
      } else {
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
      }
      state.visible = !state.visible
    },
    markShown() {
      state.visible = true
    },
    getState() {
      return state
    }
  }
}

export interface SetupTrayDeps {
  mainWindow: BrowserWindow
  timelineService: {
    markNow(source: 'hotkey' | 'tray' | 'renderer'): unknown
  }
  normalIconPath: string
  markedIconPath: string
}

let activeTrayInstance: {
  destroy: () => void
  triggerFeedback: () => void
} | null = null

export function setupTray(deps: SetupTrayDeps): {
  destroy: () => void
  triggerFeedback: () => void
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Tray, Menu, app } = require('electron')

  const tray = new Tray(deps.normalIconPath)
  tray.setToolTip('Timeline Journal')

  // 使用手动状态追踪来切换窗口显隐，避免在 Windows 上点击托盘时
  // 窗口因失焦/最小化导致 isVisible() 返回错误值，进而永不走入隐藏分支。
  const windowToggler = createWindowToggler(deps.mainWindow)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开今日时间线',
      click: () => {
        if (deps.mainWindow.isMinimized()) deps.mainWindow.restore()
        deps.mainWindow.show()
        deps.mainWindow.focus()
        windowToggler.markShown()
      }
    },
    {
      label: '标记此刻',
      click: () => {
        deps.timelineService.markNow('tray')
        if (activeTrayInstance) {
          activeTrayInstance.triggerFeedback()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.on('click', () => {
    windowToggler.toggle()
  })

  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu)
  })

  const adapter: TrayAdapter = {
    setImage: (path: string) => tray.setImage(path),
    setContextMenu: (menu: Menu) => tray.setContextMenu(menu),
    setToolTip: (tip: string) => tray.setToolTip(tip),
    onLeftClick: (cb: () => void) => tray.on('click', cb)
  }

  const manager = new TrayManager({
    adapter,
    normalIconPath: deps.normalIconPath,
    markedIconPath: deps.markedIconPath
  })

  activeTrayInstance = {
    destroy: () => {
      manager.destroy()
      tray.destroy()
    },
    triggerFeedback: () => manager.triggerFeedback()
  }

  return activeTrayInstance
}
