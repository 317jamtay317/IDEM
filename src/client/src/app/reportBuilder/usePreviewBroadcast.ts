import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createPreviewHub,
  type PreviewFrame,
  type PreviewHub,
  type PreviewHubOptions,
  type PreviewLock,
  type PreviewParticipant,
} from './previewHub'

/** The live-preview connection state surfaced for an embedded preview pane. */
export type PreviewStatus = 'connecting' | 'live' | 'error'

/** Debounce window (ms) for coalescing rapid selection changes into one publish. */
const SELECTION_DEBOUNCE_MS = 150

/**
 * Throttle window (ms) between live-cursor publishes: frequent enough that a moving pointer feels live to
 * other participants, sparse enough not to flood the hub on every pointer event.
 */
const CURSOR_THROTTLE_MS = 50

/** Another participant's live cursor: their connection id and page-absolute position, in inches. */
export interface PreviewCursor {
  /** The connection the cursor belongs to (joined with the roster for its colour and name). */
  connectionId: string
  /** The cursor's page-absolute X position, in inches. */
  x: number
  /** The cursor's page-absolute Y position, in inches. */
  y: number
}

/** Options for {@link usePreviewBroadcast}. */
export interface PreviewBroadcastOptions {
  /** The preview session id (the Report Template's id) to broadcast and collaborate under. */
  sessionId: string
  /** The template's current RDL; each change is pushed (debounced) to watchers. */
  rdl: string
  /** Bearer token for the hub handshake. Broadcasting and presence are inactive without one. */
  accessToken?: string | null
  /** The editor's current element selection; published (debounced) so other participants see it. */
  selectedIds?: string[]
  /** Debounce window for coalescing rapid edits into one RDL push (ms). Defaults to 300. */
  debounceMs?: number
  /** Builds the hub; injectable for tests. Defaults to the live SignalR hub. */
  createHub?: (options: PreviewHubOptions) => PreviewHub
}

/** The live-collaboration state the editor renders from {@link usePreviewBroadcast}. */
export interface PreviewBroadcast {
  /** Everyone present in the session, including this editor (identity is server-derived). */
  participants: PreviewParticipant[]
  /** The advisory soft-locks currently held in the session. */
  locks: PreviewLock[]
  /** This connection's id (or `null` before it connects) — used to filter the local participant out. */
  connectionId: string | null
  /** Other participants' live cursors (the server never echoes this editor's own); page-absolute inches. */
  cursors: PreviewCursor[]
  /** The latest engine-rendered page images for this session (one base64 PNG per page); drives the preview pane. */
  frames: PreviewFrame[]
  /** The live-preview connection state, for the preview pane's status indicator. */
  previewStatus: PreviewStatus
  /** The latest render error for this session, if the pushed RDL could not be rendered. */
  previewError: string | null
  /** Places an advisory soft-lock on an element (called on edit intent). */
  claim: (elementId: string) => void
  /** Releases this editor's advisory soft-lock on an element. */
  release: (elementId: string) => void
  /**
   * Publishes this editor's pointer position (page-absolute inches) so other participants see it move.
   * Throttled internally; safe to call on every pointer move. A no-op without an active connection.
   */
  publishCursor: (position: { x: number; y: number }) => void
}

/**
 * Drives the Report Builder's live-preview channel: it pushes the editor's RDL changes (debounced) so
 * watchers see the report build, and it carries multi-user collaboration — the editor joins the session as
 * a participant, publishes its selection, and can claim/release advisory soft-locks, while exposing the
 * session's participants and locks for the canvas to overlay. One SignalR connection serves both concerns,
 * so the editor appears exactly once in the roster. Inactive until an access token is present (the hub is
 * SiteAdmin-gated), so it is a no-op when rendered without one. A transient reconnect replays the join,
 * selection, and any held lock, since reconnecting yields a fresh connection.
 */
export function usePreviewBroadcast({
  sessionId,
  rdl,
  accessToken,
  selectedIds,
  debounceMs = 300,
  createHub = createPreviewHub,
}: PreviewBroadcastOptions): PreviewBroadcast {
  // Hold the latest token in a ref so the hub reads the current value without reconnecting on refresh.
  const tokenRef = useRef(accessToken)
  useEffect(() => {
    tokenRef.current = accessToken
  }, [accessToken])

  // The hub factory is an injection seam (defaults to the live hub); hold it in a ref so re-renders don't
  // tear down and rebuild the connection — it must depend only on the session and token.
  const createHubRef = useRef(createHub)
  useEffect(() => {
    createHubRef.current = createHub
  }, [createHub])

  // Latest selection and the element this editor intends to hold a lock on, in refs, so a reconnect can
  // replay them. heldRef is claim *intent* (the element being edited), not confirmed ownership — the
  // authoritative lock state comes from the server's `locks` broadcasts; re-claiming on reconnect is the
  // desired advisory behaviour (it never steals, so the UI shows the real holder if another editor took it).
  const selectionRef = useRef<string[]>(selectedIds ?? [])
  useEffect(() => {
    selectionRef.current = selectedIds ?? []
  }, [selectedIds])
  const heldRef = useRef<string | null>(null)

  const [participants, setParticipants] = useState<PreviewParticipant[]>([])
  const [locks, setLocks] = useState<PreviewLock[]>([])
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [cursors, setCursors] = useState<PreviewCursor[]>([])
  const [frames, setFrames] = useState<PreviewFrame[]>([])
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('connecting')
  const [previewError, setPreviewError] = useState<string | null>(null)

  const hubRef = useRef<{ hub: PreviewHub; ready: Promise<unknown> } | null>(null)

  // The latest pointer position awaiting publish, and the open throttle window's timer (see publishCursor).
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null)
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Open one connection per session (when authenticated); join, subscribe to presence/locks, and replay on
  // reconnect. Close it on unmount or change.
  useEffect(() => {
    if (!accessToken) return
    const hub = createHubRef.current({ accessTokenFactory: () => tokenRef.current ?? undefined })

    // Subscribe before starting so no early broadcast is missed.
    const offParticipants = hub.onParticipants((sid, next) => {
      if (sid !== sessionId) return
      setParticipants(next)
      // Drop the cursors of anyone no longer present so a departed participant's pointer can't linger.
      const present = new Set(next.map((participant) => participant.connectionId))
      setCursors((prev) => prev.filter((cursor) => present.has(cursor.connectionId)))
    })
    const offLocks = hub.onLocks((sid, next) => {
      if (sid === sessionId) setLocks(next)
    })
    const offCursor = hub.onCursorMoved((sid, conn, x, y) => {
      if (sid !== sessionId) return
      // Keep one position per connection (latest wins); identity comes from the server, never client args.
      setCursors((prev) => [...prev.filter((cursor) => cursor.connectionId !== conn), { connectionId: conn, x, y }])
    })
    // The editor is in the session group, so its own pushes (and any other editor's) come back as frames —
    // driving the side-by-side preview pane from this one connection without a second watcher.
    const offFrames = hub.onFrames((sid, pages) => {
      if (sid !== sessionId) return
      setFrames(pages)
      setPreviewStatus('live')
      setPreviewError(null)
    })
    const offError = hub.onError((sid, message) => {
      if (sid === sessionId) setPreviewError(message)
    })
    hub.onReconnected(() => {
      // Ignore a reconnect from a hub this effect has since replaced (e.g. the session changed): it must
      // not overwrite the current connection's id or republish onto a stale connection.
      if (hubRef.current?.hub !== hub) return
      // The pre-drop frames may be out of date; drop back to "connecting" so the pane isn't shown as live
      // until the re-join replays fresh frames (which then flips it back to "live").
      setPreviewStatus('connecting')
      // A reconnect is a fresh connection: re-join, re-publish the selection, and re-claim any held lock.
      void hub
        .join(sessionId)
        .then(() => {
          if (hubRef.current?.hub !== hub) return undefined
          setConnectionId(hub.connectionId())
          return hub.updateSelection(selectionRef.current)
        })
        .then(() =>
          hubRef.current?.hub === hub && heldRef.current ? hub.claimElement(heldRef.current) : undefined,
        )
        .catch(() => {})
    })

    const ready = hub
      .start()
      .then(() => hub.join(sessionId))
      .then(() => setConnectionId(hub.connectionId()))
      .catch(() => setPreviewStatus('error'))
    hubRef.current = { hub, ready }

    return () => {
      offParticipants()
      offLocks()
      offCursor()
      offFrames()
      offError()
      hubRef.current = null
      heldRef.current = null
      // Close any open cursor-throttle window so it can't fire against the next session's connection.
      if (cursorTimerRef.current !== null) {
        clearTimeout(cursorTimerRef.current)
        cursorTimerRef.current = null
      }
      pendingCursorRef.current = null
      setParticipants([])
      setLocks([])
      setCursors([])
      setFrames([])
      setPreviewStatus('connecting')
      setPreviewError(null)
      setConnectionId(null)
      void hub.stop()
    }
  }, [sessionId, accessToken])

  // Push the latest RDL once edits settle, after the connection is ready.
  useEffect(() => {
    if (!accessToken) return
    const handle = setTimeout(() => {
      const entry = hubRef.current
      if (!entry) return
      void entry.ready
        .then(() => {
          if (hubRef.current !== entry) return undefined
          return entry.hub.pushRdl(sessionId, rdl)
        })
        .catch(() => {})
    }, debounceMs)
    return () => clearTimeout(handle)
  }, [sessionId, rdl, accessToken, debounceMs])

  // Publish the latest selection once it settles, so others see what this editor has selected.
  useEffect(() => {
    if (!accessToken) return
    const handle = setTimeout(() => {
      const entry = hubRef.current
      if (!entry) return
      void entry.ready
        .then(() => {
          if (hubRef.current !== entry) return undefined
          return entry.hub.updateSelection(selectedIds ?? [])
        })
        .catch(() => {})
    }, SELECTION_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [sessionId, selectedIds, accessToken])

  const claim = useCallback((elementId: string) => {
    heldRef.current = elementId
    void hubRef.current?.hub.claimElement(elementId).catch(() => {})
  }, [])

  const release = useCallback((elementId: string) => {
    if (heldRef.current === elementId) heldRef.current = null
    void hubRef.current?.hub.releaseElement(elementId).catch(() => {})
  }, [])

  // Publish the pointer position on a throttle: the leading call sends at once; while moving, the window
  // timer flushes the latest position every CURSOR_THROTTLE_MS and stops once the pointer settles. A no-op
  // without an active connection (hubRef is null until authenticated).
  const publishCursor = useCallback((position: { x: number; y: number }) => {
    pendingCursorRef.current = position
    if (cursorTimerRef.current !== null) return
    const flush = () => {
      const next = pendingCursorRef.current
      pendingCursorRef.current = null
      if (next === null) {
        cursorTimerRef.current = null
        return
      }
      const entry = hubRef.current
      if (entry) {
        void entry.ready
          .then(() => (hubRef.current === entry ? entry.hub.updateCursor(next.x, next.y) : undefined))
          .catch(() => {})
      }
      cursorTimerRef.current = setTimeout(flush, CURSOR_THROTTLE_MS)
    }
    flush()
  }, [])

  return {
    participants,
    locks,
    connectionId,
    cursors,
    frames,
    previewStatus,
    previewError,
    claim,
    release,
    publishCursor,
  }
}
