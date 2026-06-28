import { globalShortcut } from 'electron'

import { notifyTimelineUpdated } from './ipc'
import { markNow } from './timeline'

export const timelineShortcutAccelerator = 'Control+Alt+Space'

export function registerTimelineShortcut(): void {
  const didRegister = globalShortcut.register(timelineShortcutAccelerator, () => {
    try {
      markNow('hotkey')
      notifyTimelineUpdated()
    } catch (error) {
      console.error('Failed to mark timeline from global shortcut.', error)
    }
  })

  if (!didRegister) {
    console.error(`Failed to register global shortcut: ${timelineShortcutAccelerator}`)
  }
}

export function unregisterTimelineShortcut(): void {
  if (globalShortcut.isRegistered(timelineShortcutAccelerator)) {
    globalShortcut.unregister(timelineShortcutAccelerator)
  }
}
