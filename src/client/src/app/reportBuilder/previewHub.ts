import { HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr'

/** The route the live preview SignalR hub is mapped to (same-origin as the SPA). */
export const PREVIEW_HUB_URL = '/hubs/report-preview'

const RECEIVE_FRAMES = 'ReceiveFrames'
const RECEIVE_ERROR = 'ReceiveError'

/** A rendered page image as received over the wire: a base64-encoded PNG. */
export type PreviewFrame = string

/** Options for {@link createPreviewHub}. */
export interface PreviewHubOptions {
  /** Supplies the current OIDC access token for the hub handshake (sent as the bearer token). */
  accessTokenFactory?: () => string | null | undefined
  /** Hub URL; defaults to {@link PREVIEW_HUB_URL} (same-origin). Overridable mainly for tests. */
  url?: string
  /**
   * Builds the underlying SignalR connection; injectable for tests. Defaults to a real connection to
   * {@link PreviewHubOptions.url} with automatic reconnect.
   */
  connectionFactory?: () => HubConnection
}

/** Thin client over the live Report Template preview hub. */
export interface PreviewHub {
  /** Opens the connection if it is not already open. */
  start: () => Promise<void>
  /** Closes the connection. */
  stop: () => Promise<void>
  /** Joins a template's preview session to receive its frames (watcher side). */
  join: (sessionId: string) => Promise<void>
  /** Pushes the template's RDL so the server renders and broadcasts it (editor side). */
  pushRdl: (sessionId: string, rdl: string) => Promise<void>
  /** Subscribes to rendered page frames for a session; returns an unsubscribe function. */
  onFrames: (handler: (sessionId: string, pages: PreviewFrame[]) => void) => () => void
  /** Subscribes to render errors (e.g. invalid RDL); returns an unsubscribe function. */
  onError: (handler: (sessionId: string, message: string) => void) => () => void
}

/**
 * Creates a {@link PreviewHub} over the SignalR hub at {@link PREVIEW_HUB_URL}. The editor calls
 * {@link PreviewHub.pushRdl} as the SiteAdmin builds a template; a watcher (the Preview Screen) calls
 * {@link PreviewHub.join} and renders the page frames delivered to {@link PreviewHub.onFrames}.
 */
export function createPreviewHub(options: PreviewHubOptions = {}): PreviewHub {
  const connection =
    options.connectionFactory?.() ??
    new HubConnectionBuilder()
      .withUrl(options.url ?? PREVIEW_HUB_URL, {
        accessTokenFactory: () => options.accessTokenFactory?.() ?? '',
      })
      .withAutomaticReconnect()
      .build()

  const subscribe = (method: string, handler: (...args: never[]) => void) => {
    const fn = handler as (...args: unknown[]) => void
    connection.on(method, fn)
    return () => connection.off(method, fn)
  }

  return {
    async start() {
      if (connection.state === HubConnectionState.Disconnected) {
        await connection.start()
      }
    },
    stop: () => connection.stop(),
    join: async (sessionId) => {
      await connection.invoke('JoinSession', sessionId)
    },
    pushRdl: async (sessionId, rdl) => {
      await connection.invoke('PushRdl', sessionId, rdl)
    },
    onFrames: (handler) => subscribe(RECEIVE_FRAMES, handler as (...args: never[]) => void),
    onError: (handler) => subscribe(RECEIVE_ERROR, handler as (...args: never[]) => void),
  }
}
