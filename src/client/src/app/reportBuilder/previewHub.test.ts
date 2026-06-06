import { describe, it, expect, vi } from 'vitest'
import { HubConnectionState, type HubConnection } from '@microsoft/signalr'
import { createPreviewHub } from './previewHub'

/** A minimal fake of the SignalR HubConnection surface the wrapper uses. */
function fakeConnection() {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  const conn = {
    state: HubConnectionState.Disconnected as HubConnectionState,
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
    /** Test helper: fire a server→client message. */
    emit(method: string, ...args: unknown[]) {
      for (const h of [...(handlers.get(method) ?? [])]) h(...args)
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
