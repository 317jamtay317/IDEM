import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreviewBroadcast } from './usePreviewBroadcast'
import type { PreviewHub } from './previewHub'

function fakeHub(): PreviewHub {
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    join: vi.fn(async () => {}),
    pushRdl: vi.fn(async () => {}),
    onFrames: vi.fn(() => () => {}),
    onError: vi.fn(() => () => {}),
  }
}

describe('usePreviewBroadcast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts the hub when an access token is present', () => {
    const hub = fakeHub()
    renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    expect(hub.start).toHaveBeenCalledOnce()
  })

  it('pushes the rdl after the debounce window', async () => {
    const hub = fakeHub()
    renderHook(() =>
      usePreviewBroadcast({
        sessionId: 's1',
        rdl: '<a/>',
        accessToken: 'tok',
        debounceMs: 300,
        createHub: () => hub,
      }),
    )

    await vi.advanceTimersByTimeAsync(300)

    expect(hub.pushRdl).toHaveBeenCalledWith('s1', '<a/>')
  })

  it('does nothing when there is no access token', async () => {
    const createHub = vi.fn(fakeHub)
    renderHook(() => usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: null, createHub }))

    await vi.advanceTimersByTimeAsync(300)

    expect(createHub).not.toHaveBeenCalled()
  })

  it('coalesces rapid edits into a single push of the latest rdl', async () => {
    const hub = fakeHub()
    const createHub = () => hub
    const { rerender } = renderHook((props: Parameters<typeof usePreviewBroadcast>[0]) =>
      usePreviewBroadcast(props), {
      initialProps: { sessionId: 's1', rdl: 'a', accessToken: 'tok', debounceMs: 300, createHub },
    })

    rerender({ sessionId: 's1', rdl: 'b', accessToken: 'tok', debounceMs: 300, createHub })
    rerender({ sessionId: 's1', rdl: 'c', accessToken: 'tok', debounceMs: 300, createHub })
    await vi.advanceTimersByTimeAsync(300)

    expect(hub.pushRdl).toHaveBeenCalledTimes(1)
    expect(hub.pushRdl).toHaveBeenCalledWith('s1', 'c')
  })

  it('stops the hub on unmount', () => {
    const hub = fakeHub()
    const { unmount } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: 'a', accessToken: 'tok', createHub: () => hub }),
    )

    unmount()

    expect(hub.stop).toHaveBeenCalled()
  })
})
