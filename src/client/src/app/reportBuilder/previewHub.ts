import { HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr'

/** The route the live preview SignalR hub is mapped to (same-origin as the SPA). */
export const PREVIEW_HUB_URL = '/hubs/report-preview'

const RECEIVE_FRAMES = 'ReceiveFrames'
const RECEIVE_ERROR = 'ReceiveError'
const PARTICIPANTS_CHANGED = 'ParticipantsChanged'
const LOCKS_CHANGED = 'LocksChanged'

/** A rendered page image as received over the wire: a base64-encoded PNG. */
export type PreviewFrame = string

/**
 * A SiteAdmin taking part in a live preview session, as broadcast by the hub. Identity is derived
 * server-side from the connection's claims, so it cannot be spoofed by the client.
 */
export interface PreviewParticipant {
  /** The participant's SignalR connection id — their identity within the session (two tabs = two of these). */
  connectionId: string
  /** The participant's stable user id (shared across their tabs). */
  userId: string
  /** The participant's display name, shown on selection labels and avatars. */
  displayName: string
  /** A stable display colour derived from the user id on the server (identical on every client). */
  color: string
  /** The element ids the participant currently has selected. */
  selectedElementIds: string[]
}

/** An advisory soft-lock on a Report Template element, as broadcast by the hub. */
export interface PreviewLock {
  /** The locked element's id. */
  elementId: string
  /** The holding connection's id. */
  connectionId: string
  /** The holder's user id. */
  userId: string
  /** The holder's display name, shown as "being edited by …". */
  displayName: string
}

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
  /** Publishes the caller's current element selection so others see it (editor side). */
  updateSelection: (elementIds: string[]) => Promise<void>
  /**
   * Claims an advisory soft-lock on an element. Resolves the resulting holder — the caller on a grant, or
   * the existing holder on contention — or `null` when the caller has not joined a session.
   */
  claimElement: (elementId: string) => Promise<PreviewLock | null>
  /** Releases the caller's advisory soft-lock on an element. */
  releaseElement: (elementId: string) => Promise<void>
  /** Subscribes to rendered page frames for a session; returns an unsubscribe function. */
  onFrames: (handler: (sessionId: string, pages: PreviewFrame[]) => void) => () => void
  /** Subscribes to render errors (e.g. invalid RDL); returns an unsubscribe function. */
  onError: (handler: (sessionId: string, message: string) => void) => () => void
  /** Subscribes to a session's participant-roster changes; returns an unsubscribe function. */
  onParticipants: (handler: (sessionId: string, participants: PreviewParticipant[]) => void) => () => void
  /** Subscribes to a session's advisory soft-lock changes; returns an unsubscribe function. */
  onLocks: (handler: (sessionId: string, locks: PreviewLock[]) => void) => () => void
  /** Subscribes to automatic-reconnect completion (carrying the new connection id); returns an unsubscribe. */
  onReconnected: (handler: (connectionId?: string) => void) => () => void
  /** The current SignalR connection id, or `null` before the connection starts — used to filter out self. */
  connectionId: () => string | null
}

/**
 * Resolves {@link PREVIEW_HUB_URL} to an absolute, same-origin URL. SignalR's relative-URL resolution
 * needs a real browser document and throws under jsdom; an absolute URL works everywhere and stays
 * same-origin in production (the leading-slash path resolves against the origin, ignoring the hash route).
 */
function resolvePreviewHubUrl(): string {
  return typeof window !== 'undefined'
    ? new URL(PREVIEW_HUB_URL, window.location.href).toString()
    : PREVIEW_HUB_URL
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
      .withUrl(options.url ?? resolvePreviewHubUrl(), {
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
    updateSelection: async (elementIds) => {
      await connection.invoke('UpdateSelection', elementIds)
    },
    claimElement: (elementId) =>
      connection.invoke('ClaimElement', elementId) as Promise<PreviewLock | null>,
    releaseElement: async (elementId) => {
      await connection.invoke('ReleaseElement', elementId)
    },
    onFrames: (handler) => subscribe(RECEIVE_FRAMES, handler as (...args: never[]) => void),
    onError: (handler) => subscribe(RECEIVE_ERROR, handler as (...args: never[]) => void),
    onParticipants: (handler) => subscribe(PARTICIPANTS_CHANGED, handler as (...args: never[]) => void),
    onLocks: (handler) => subscribe(LOCKS_CHANGED, handler as (...args: never[]) => void),
    onReconnected: (handler) => {
      // SignalR exposes no off() for onreconnected; the handler lives with the connection.
      connection.onreconnected((id?: string) => handler(id))
      return () => {}
    },
    connectionId: () => connection.connectionId,
  }
}
