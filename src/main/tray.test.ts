/* eslint-disable @typescript-eslint/unbound-method */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  createWindowToggler,
  toggleWindowVisibility,
  TrayManager,
  type TrayAdapter,
  type WindowAdapter
} from './tray'

describe('TrayManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初始状态使用 normal 图标，调用 triggerFeedback 时切换为 marked 图标', () => {
    const mockAdapter: TrayAdapter = {
      setImage: vi.fn(),
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
      onLeftClick: vi.fn()
    }

    const manager = new TrayManager({
      adapter: mockAdapter,
      normalIconPath: 'normal.png',
      markedIconPath: 'marked.png'
    })

    expect(mockAdapter.setImage).toHaveBeenCalledWith('normal.png')

    manager.triggerFeedback()
    expect(mockAdapter.setImage).toHaveBeenCalledWith('marked.png')
  })

  it('500ms 后自动恢复 normal 图标', () => {
    const mockAdapter: TrayAdapter = {
      setImage: vi.fn(),
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
      onLeftClick: vi.fn()
    }

    const manager = new TrayManager({
      adapter: mockAdapter,
      normalIconPath: 'normal.png',
      markedIconPath: 'marked.png'
    })

    manager.triggerFeedback()
    expect(mockAdapter.setImage).toHaveBeenLastCalledWith('marked.png')

    vi.advanceTimersByTime(500)
    expect(mockAdapter.setImage).toHaveBeenLastCalledWith('normal.png')
  })

  it('在 500ms 内连续触发 markNow 时，防抖并重置定时器', () => {
    const mockAdapter: TrayAdapter = {
      setImage: vi.fn(),
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
      onLeftClick: vi.fn()
    }

    const manager = new TrayManager({
      adapter: mockAdapter,
      normalIconPath: 'normal.png',
      markedIconPath: 'marked.png'
    })

    manager.triggerFeedback()
    vi.advanceTimersByTime(300)
    expect(mockAdapter.setImage).toHaveBeenLastCalledWith('marked.png')

    // 再次触发，应该重置定时器
    manager.triggerFeedback()
    vi.advanceTimersByTime(300)
    // 距离上次触发仅 300ms，应当依然是 marked.png
    expect(mockAdapter.setImage).toHaveBeenLastCalledWith('marked.png')

    vi.advanceTimersByTime(200)
    // 满 500ms 后才恢复 normal.png
    expect(mockAdapter.setImage).toHaveBeenLastCalledWith('normal.png')
  })

  it('当窗口可见且未最小化时（即使未获得焦点），点击托盘应当隐藏窗口', () => {
    const mockWindow = {
      isVisible: vi.fn().mockReturnValue(true),
      isMinimized: vi.fn().mockReturnValue(false),
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      restore: vi.fn()
    }

    toggleWindowVisibility(mockWindow)
    expect(mockWindow.hide).toHaveBeenCalled()
    expect(mockWindow.show).not.toHaveBeenCalled()
  })
})

describe('createWindowToggler', () => {
  function createMockWindow(): WindowAdapter {
    return {
      isVisible: vi.fn(),
      isMinimized: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      restore: vi.fn()
    }
  }

  it('初始状态为可见，首次 toggle 应当隐藏窗口', () => {
    const mockWindow = createMockWindow()
    const toggler = createWindowToggler(mockWindow)

    toggler.toggle()

    expect(toggler.getState().visible).toBe(false)
    expect(mockWindow.hide).toHaveBeenCalled()
    expect(mockWindow.show).not.toHaveBeenCalled()
  })

  it('隐藏后再次 toggle 应当显示窗口', () => {
    const mockWindow = createMockWindow()
    const toggler = createWindowToggler(mockWindow)

    toggler.toggle() // visible → hidden
    toggler.toggle() // hidden → visible

    expect(toggler.getState().visible).toBe(true)
    expect(mockWindow.hide).toHaveBeenCalledTimes(1)
    expect(mockWindow.show).toHaveBeenCalledTimes(1)
    expect(mockWindow.focus).toHaveBeenCalledTimes(1)
  })

  it('完整 round-trip：可见 → 隐藏 → 可见 → 隐藏', () => {
    const mockWindow = createMockWindow()
    const toggler = createWindowToggler(mockWindow)

    // 1: visible → hidden
    toggler.toggle()
    expect(toggler.getState().visible).toBe(false)
    expect(mockWindow.hide).toHaveBeenCalledTimes(1)

    // 2: hidden → visible
    toggler.toggle()
    expect(toggler.getState().visible).toBe(true)
    expect(mockWindow.show).toHaveBeenCalledTimes(1)

    // 3: visible → hidden
    toggler.toggle()
    expect(toggler.getState().visible).toBe(false)
    expect(mockWindow.hide).toHaveBeenCalledTimes(2)

    // 4: hidden → visible
    toggler.toggle()
    expect(toggler.getState().visible).toBe(true)
    expect(mockWindow.show).toHaveBeenCalledTimes(2)
  })

  it('markShown 将状态重置为可见', () => {
    const mockWindow = createMockWindow()
    const toggler = createWindowToggler(mockWindow)

    toggler.toggle() // visible → hidden
    expect(toggler.getState().visible).toBe(false)

    toggler.markShown()
    expect(toggler.getState().visible).toBe(true)

    // 再用 toggle 应当隐藏
    toggler.toggle()
    expect(mockWindow.hide).toHaveBeenCalledTimes(2)
  })

  it('窗口最小化时 toggle 显示应当先恢复再显示', () => {
    const mockWindow = createMockWindow()
    ;(mockWindow.isMinimized as ReturnType<typeof vi.fn>).mockReturnValue(true)

    const toggler = createWindowToggler(mockWindow)

    toggler.toggle() // state: visible → hidden
    toggler.toggle() // state: hidden → visible, but window is minimized

    expect(mockWindow.restore).toHaveBeenCalledTimes(1)
    expect(mockWindow.show).toHaveBeenCalledTimes(1)
  })

  it('即使在 toggle 时 isVisible() 返回错误值，状态追踪仍保证正确切换', () => {
    // 模拟 Windows 点击托盘时窗口失焦导致 isVisible() 返回 false 的场景
    const mockWindow = createMockWindow()
    const toggler = createWindowToggler(mockWindow)

    // 首次 toggle: 隐藏窗口（state: visible → hidden）
    toggler.toggle()
    expect(mockWindow.hide).toHaveBeenCalledTimes(1)
    expect(toggler.getState().visible).toBe(false)

    // 即使 isVisible() 此时返回错误值，toggle 仍基于 tracked state 工作
    // state 是 hidden，所以应该 show
    toggler.toggle()
    expect(mockWindow.show).toHaveBeenCalledTimes(1)
    expect(toggler.getState().visible).toBe(true)

    // state 是 visible，所以应该 hide
    toggler.toggle()
    expect(mockWindow.hide).toHaveBeenCalledTimes(2)
    expect(toggler.getState().visible).toBe(false)
  })
})
