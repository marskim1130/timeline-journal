import { globalShortcut } from 'electron'

import type { TimelineService } from './timeline-service'

export const timelineShortcutAccelerator = 'Control+Alt+Space'

export function registerTimelineShortcut(service: TimelineService): void {
  const didRegister = globalShortcut.register(timelineShortcutAccelerator, () => {
    try {
      service.markNow('hotkey')
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
