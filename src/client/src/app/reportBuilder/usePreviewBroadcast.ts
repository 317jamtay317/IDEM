import { useEffect, useRef } from 'react'
import { createPreviewHub, type PreviewHub, type PreviewHubOptions } from './previewHub'

/** Options for {@link usePreviewBroadcast}. */
export interface PreviewBroadcastOptions {
  /** The preview session id (the Report Template's id) to broadcast under. */
  sessionId: string
  /** The template's current RDL; each change is pushed (debounced) to watchers. */
  rdl: string
  /** Bearer token for the hub handshake. Broadcasting is inactive without one. */
  accessToken?: string | null
  /** Debounce window for coalescing rapid edits into one push (ms). Defaults to 300. */
  debounceMs?: number
  /** Builds the hub; injectable for tests. Defaults to the live SignalR hub. */
  createHub?: (options: PreviewHubOptions) => PreviewHub
}

/**
 * Broadcasts the Report Builder's live edits to the preview hub. As a SiteAdmin builds, each RDL change
 * is pushed (debounced) so watchers see the report update in near-real time. Inactive until an access
 * token is present — the hub is SiteAdmin-gated — so it is a no-op when rendered without one.
 */
export function usePreviewBroadcast({
  sessionId,
  rdl,
  accessToken,
  debounceMs = 300,
  createHub = createPreviewHub,
}: PreviewBroadcastOptions): void {
  // Hold the latest token in a ref so the hub reads the current value without reconnecting on refresh.
  const tokenRef = useRef(accessToken)
  useEffect(() => {
    tokenRef.current = accessToken
  }, [accessToken])

  const hubRef = useRef<{ hub: PreviewHub; ready: Promise<unknown> } | null>(null)

  // Open one connection per session (when authenticated); close it on unmount or change.
  useEffect(() => {
    if (!accessToken) return
    const hub = createHub({ accessTokenFactory: () => tokenRef.current ?? undefined })
    const ready = hub.start().catch(() => {})
    hubRef.current = { hub, ready }
    return () => {
      hubRef.current = null
      void hub.stop()
    }
  }, [sessionId, accessToken, createHub])

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
}
