import { describe, it, expect, vi } from 'vitest'
import { HubConnectionState, type HubConnection } from '@microsoft/signalr'
import { createPreviewHub } from './previewHub'

/** A minimal fake of the SignalR HubConnection surface the wrapper uses. */
function fakeConnection() {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  const reconnectHandlers: Array<(id?: string) => void> = []
  const conn = {
    state: HubConnectionState.Disconnected as HubConnectionState,
    connectionId: 'conn-1' as string | null,
    start: vi.fn(async () => {
      conn.state = HubConnectionState.Connected
    }),
    stop: vi.fn(async () => {
      conn.state = HubConnectionState.Disconnected
    }),
    invoke: vi.fn(async () => undefined),
    on: vi.fn((method: string, handler: (...args: unknown[]) => void) => {
      handlers.set(method, [...(handlers.get(method) ?? []), handler])
    }),
    off: vi.fn((method: string, handler: (...args: unknown[]) => void) => {
      handlers.set(method, (handlers.get(method) ?? []).filter((h) => h !== handler))
    }),
    onreconnected: vi.fn((cb: (id?: string) => void) => {
      reconnectHandlers.push(cb)
    }),
    /** Test helper: fire a server→client message. */
    emit(method: string, ...args: unknown[]) {
      for (const h of [...(handlers.get(method) ?? [])]) h(...args)
    },
    /** Test helper: simulate an automatic reconnect completing. */
    reconnect(id?: string) {
      for (const cb of [...reconnectHandlers]) cb(id)
    },
  }
  return conn
}

function hubWith(conn: ReturnType<typeof fakeConnection>) {
  return createPreviewHub({ connectionFactory: () => conn as unknown as HubConnection })
}

describe('createPreviewHub', () => {
  it('starts the connection when it is disconnected', async () => {
    const conn = fakeConnection()
    await hubWith(conn).start()
    expect(conn.start).toHaveBeenCalledOnce()
  })

  it('does not start the connection when it is already connected', async () => {
    const conn = fakeConnection()
    conn.state = HubConnectionState.Connected
    await hubWith(conn).start()
    expect(conn.start).not.toHaveBeenCalled()
  })

  it('joins a session by invoking JoinSession', async () => {
    const conn = fakeConnection()
    await hubWith(conn).join('tpl-1')
    expect(conn.invoke).toHaveBeenCalledWith('JoinSession', 'tpl-1')
  })

  it('pushes RDL by invoking PushRdl with the session id and rdl', async () => {
    const conn = fakeConnection()
    await hubWith(conn).pushRdl('tpl-1', '<Report/>')
    expect(conn.invoke).toHaveBeenCalledWith('PushRdl', 'tpl-1', '<Report/>')
  })

  it('forwards ReceiveFrames payloads to onFrames subscribers and stops after unsubscribe', () => {
    const conn = fakeConnection()
    const frames = vi.fn()
    const unsubscribe = hubWith(conn).onFrames(frames)

    conn.emit('ReceiveFrames', 'tpl-1', ['QUJD', 'REVG'])
    expect(frames).toHaveBeenCalledWith('tpl-1', ['QUJD', 'REVG'])

    unsubscribe()
    conn.emit('ReceiveFrames', 'tpl-1', ['R0hJ'])
    expect(frames).toHaveBeenCalledTimes(1)
  })

  it('forwards ReceiveError payloads to onError subscribers', () => {
    const conn = fakeConnection()
    const onError = vi.fn()
    hubWith(conn).onError(onError)

    conn.emit('ReceiveError', 'tpl-1', 'The report template (RDL) must not be empty.')
    expect(onError).toHaveBeenCalledWith('tpl-1', 'The report template (RDL) must not be empty.')
  })

  it('publishes a selection by invoking UpdateSelection with the element ids (no session id)', async () => {
    const conn = fakeConnection()
    await hubWith(conn).updateSelection(['el-a', 'el-b'])
    expect(conn.invoke).toHaveBeenCalledWith('UpdateSelection', ['el-a', 'el-b'])
  })

  it('claims an element by invoking ClaimElement and resolves the returned holder', async () => {
    const conn = fakeConnection()
    const holder = { elementId: 'el-a', connectionId: 'c9', userId: 'u9', displayName: 'Ada' }
    conn.invoke.mockResolvedValueOnce(holder as never)

    const result = await hubWith(conn).claimElement('el-a')

    expect(conn.invoke).toHaveBeenCalledWith('ClaimElement', 'el-a')
    expect(result).toEqual(holder)
  })

  it('releases an element by invoking ReleaseElement with the element id', async () => {
    const conn = fakeConnection()
    await hubWith(conn).releaseElement('el-a')
    expect(conn.invoke).toHaveBeenCalledWith('ReleaseElement', 'el-a')
  })

  it('forwards ParticipantsChanged payloads to onParticipants subscribers and stops after unsubscribe', () => {
    const conn = fakeConnection()
    const onParticipants = vi.fn()
    const unsubscribe = hubWith(conn).onParticipants(onParticipants)
    const roster = [{ connectionId: 'c1', userId: 'u1', displayName: 'Ada', color: '#111', selectedElementIds: [] }]

    conn.emit('ParticipantsChanged', 'tpl-1', roster)
    expect(onParticipants).toHaveBeenCalledWith('tpl-1', roster)

    unsubscribe()
    conn.emit('ParticipantsChanged', 'tpl-1', roster)
    expect(onParticipants).toHaveBeenCalledTimes(1)
  })

  it('publishes a cursor by invoking UpdateCursor with the coordinates (no session id)', async () => {
    const conn = fakeConnection()
    await hubWith(conn).updateCursor(1.5, 2.25)
    expect(conn.invoke).toHaveBeenCalledWith('UpdateCursor', 1.5, 2.25)
  })

  it('forwards CursorMoved payloads to onCursorMoved subscribers and stops after unsubscribe', () => {
    const conn = fakeConnection()
    const onCursor = vi.fn()
    const unsubscribe = hubWith(conn).onCursorMoved(onCursor)

    conn.emit('CursorMoved', 'tpl-1', 'conn-2', 1.5, 2.25)
    expect(onCursor).toHaveBeenCalledWith('tpl-1', 'conn-2', 1.5, 2.25)

    unsubscribe()
    conn.emit('CursorMoved', 'tpl-1', 'conn-2', 3, 4)
    expect(onCursor).toHaveBeenCalledTimes(1)
  })

  it('forwards LocksChanged payloads to onLocks subscribers', () => {
    const conn = fakeConnection()
    const onLocks = vi.fn()
    hubWith(conn).onLocks(onLocks)
    const locks = [{ elementId: 'el-a', connectionId: 'c1', userId: 'u1', displayName: 'Ada' }]

    conn.emit('LocksChanged', 'tpl-1', locks)
    expect(onLocks).toHaveBeenCalledWith('tpl-1', locks)
  })

  it('invokes onReconnected handlers when the connection reconnects', () => {
    const conn = fakeConnection()
    const onReconnected = vi.fn()
    hubWith(conn).onReconnected(onReconnected)

    conn.reconnect('conn-2')

    expect(onReconnected).toHaveBeenCalledWith('conn-2')
  })

  it('exposes the current connection id for self-filtering', () => {
    const conn = fakeConnection()
    expect(hubWith(conn).connectionId()).toBe('conn-1')
  })

  it('builds a real connection by default and exposes the hub surface', () => {
    // An absolute URL avoids the SignalR client's relative-URL resolution, which needs a real browser.
    const hub = createPreviewHub({
      accessTokenFactory: () => 'tok',
      url: 'http://localhost/hubs/report-preview',
    })
    expect(typeof hub.start).toBe('function')
    expect(typeof hub.join).toBe('function')
    expect(typeof hub.pushRdl).toBe('function')
    expect(typeof hub.onFrames).toBe('function')
  })
})
