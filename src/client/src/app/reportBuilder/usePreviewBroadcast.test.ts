import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePreviewBroadcast } from './usePreviewBroadcast'
import type { PreviewHub, PreviewParticipant } from './previewHub'

function fakeHub(): PreviewHub {
  return {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    join: vi.fn(async () => {}),
    pushRdl: vi.fn(async () => {}),
    updateSelection: vi.fn(async () => {}),
    updateCursor: vi.fn(async () => {}),
    claimElement: vi.fn(async () => null),
    releaseElement: vi.fn(async () => {}),
    onFrames: vi.fn(() => () => {}),
    onError: vi.fn(() => () => {}),
    onParticipants: vi.fn(() => () => {}),
    onLocks: vi.fn(() => () => {}),
    onCursorMoved: vi.fn(() => () => {}),
    onReconnected: vi.fn(() => () => {}),
    connectionId: vi.fn(() => 'conn-1'),
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

  it('joins the session so the editor appears as a participant', async () => {
    const hub = fakeHub()
    renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )

    await act(async () => {}) // let start().then(join) settle
    expect(hub.join).toHaveBeenCalledWith('s1')
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

  it('publishes the selection after it settles', async () => {
    const hub = fakeHub()
    renderHook(() =>
      usePreviewBroadcast({
        sessionId: 's1',
        rdl: '<a/>',
        accessToken: 'tok',
        selectedIds: ['el-a'],
        createHub: () => hub,
      }),
    )

    await vi.advanceTimersByTimeAsync(300)

    expect(hub.updateSelection).toHaveBeenCalledWith(['el-a'])
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

  it('exposes the session participants from ParticipantsChanged events', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )

    const roster: PreviewParticipant[] = [
      { connectionId: 'c2', userId: 'u2', displayName: 'Grace', color: '#222', selectedElementIds: ['el-a'] },
    ]
    const handler = vi.mocked(hub.onParticipants).mock.calls[0][0]
    act(() => handler('s1', roster))

    expect(result.current.participants).toEqual(roster)
  })

  it('claims and releases advisory locks through the hub', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    act(() => result.current.claim('el-a'))
    expect(hub.claimElement).toHaveBeenCalledWith('el-a')

    act(() => result.current.release('el-a'))
    expect(hub.releaseElement).toHaveBeenCalledWith('el-a')
  })

  it('re-joins and replays the selection on reconnect', async () => {
    const hub = fakeHub()
    renderHook(() =>
      usePreviewBroadcast({
        sessionId: 's1',
        rdl: '<a/>',
        accessToken: 'tok',
        selectedIds: ['el-a'],
        createHub: () => hub,
      }),
    )
    await act(async () => {})
    vi.mocked(hub.join).mockClear()

    const reconnected = vi.mocked(hub.onReconnected).mock.calls[0][0]
    await act(async () => {
      reconnected('conn-2')
    })

    expect(hub.join).toHaveBeenCalledWith('s1')
    expect(hub.updateSelection).toHaveBeenCalledWith(['el-a'])
  })

  it('re-claims a held lock on reconnect', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    // The editor holds a lock on 'el-a', then the connection transiently drops and reconnects.
    act(() => result.current.claim('el-a'))
    vi.mocked(hub.claimElement).mockClear()

    const reconnected = vi.mocked(hub.onReconnected).mock.calls[0][0]
    await act(async () => {
      reconnected('conn-2')
    })

    expect(hub.claimElement).toHaveBeenCalledWith('el-a')
  })

  it('does not re-claim on reconnect when no lock is held', async () => {
    const hub = fakeHub()
    renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    const reconnected = vi.mocked(hub.onReconnected).mock.calls[0][0]
    await act(async () => {
      reconnected('conn-2')
    })

    expect(hub.claimElement).not.toHaveBeenCalled()
  })

  it('publishes a cursor through the hub on the leading edge', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {}) // let start().then(join) settle so the connection is ready

    act(() => result.current.publishCursor({ x: 1.5, y: 2.25 }))
    await act(async () => {}) // flush the ready→updateCursor microtask

    expect(hub.updateCursor).toHaveBeenCalledWith(1.5, 2.25)
  })

  it('throttles rapid cursor moves, sending the latest position on the trailing edge', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    act(() => {
      result.current.publishCursor({ x: 1, y: 1 })
      result.current.publishCursor({ x: 2, y: 2 })
      result.current.publishCursor({ x: 3, y: 3 })
    })
    await act(async () => {}) // leading edge fires once with the first position

    expect(hub.updateCursor).toHaveBeenCalledTimes(1)
    expect(hub.updateCursor).toHaveBeenLastCalledWith(1, 1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50) // trailing edge flushes the latest position
    })

    expect(hub.updateCursor).toHaveBeenCalledTimes(2)
    expect(hub.updateCursor).toHaveBeenLastCalledWith(3, 3)
  })

  it('exposes other participants’ cursors from CursorMoved events', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    const handler = vi.mocked(hub.onCursorMoved).mock.calls[0][0]
    act(() => handler('s1', 'conn-2', 3.5, 4.5))

    expect(result.current.cursors).toEqual([{ connectionId: 'conn-2', x: 3.5, y: 4.5 }])
  })

  it('ignores cursor moves for a different session', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    const handler = vi.mocked(hub.onCursorMoved).mock.calls[0][0]
    act(() => handler('other-session', 'conn-2', 1, 1))

    expect(result.current.cursors).toEqual([])
  })

  it('drops a remote cursor when its participant leaves the roster', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    const cursorHandler = vi.mocked(hub.onCursorMoved).mock.calls[0][0]
    const participantsHandler = vi.mocked(hub.onParticipants).mock.calls[0][0]

    act(() => cursorHandler('s1', 'conn-2', 1, 1))
    expect(result.current.cursors).toHaveLength(1)

    act(() => participantsHandler('s1', [])) // conn-2 is gone → its cursor is pruned
    expect(result.current.cursors).toEqual([])
  })

  it('exposes rendered frames and goes live on ReceiveFrames', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    expect(result.current.previewStatus).toBe('connecting')
    const handler = vi.mocked(hub.onFrames).mock.calls[0][0]
    act(() => handler('s1', ['QUJD', 'REVG']))

    expect(result.current.frames).toEqual(['QUJD', 'REVG'])
    expect(result.current.previewStatus).toBe('live')
  })

  it('ignores frames for a different session', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    const handler = vi.mocked(hub.onFrames).mock.calls[0][0]
    act(() => handler('other', ['QUJD']))

    expect(result.current.frames).toEqual([])
  })

  it('resets the preview status to connecting on reconnect (until fresh frames arrive)', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    // Go live, then drop and reconnect: the status must not stay "live" showing the pre-drop frames —
    // it returns to "connecting" until the session re-join replays fresh frames.
    const frames = vi.mocked(hub.onFrames).mock.calls[0][0]
    act(() => frames('s1', ['QUJD']))
    expect(result.current.previewStatus).toBe('live')

    const reconnected = vi.mocked(hub.onReconnected).mock.calls[0][0]
    await act(async () => {
      reconnected('conn-2')
    })

    expect(result.current.previewStatus).toBe('connecting')
  })

  it('reports an error preview status when the connection cannot start', async () => {
    const hub = fakeHub()
    vi.mocked(hub.start).mockRejectedValueOnce(new Error('handshake failed'))
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: 'tok', createHub: () => hub }),
    )
    await act(async () => {})

    expect(result.current.previewStatus).toBe('error')
  })

  it('does not publish a cursor when there is no access token', async () => {
    const hub = fakeHub()
    const { result } = renderHook(() =>
      usePreviewBroadcast({ sessionId: 's1', rdl: '<a/>', accessToken: null, createHub: () => hub }),
    )

    act(() => result.current.publishCursor({ x: 1, y: 1 }))
    await act(async () => {})

    expect(hub.updateCursor).not.toHaveBeenCalled()
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
