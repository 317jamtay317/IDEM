import { useEffect, useRef, useState } from 'react'
import {
  createPreviewHub,
  type PreviewFrame,
  type PreviewHub,
  type PreviewHubOptions,
  type PreviewParticipant,
} from '../reportBuilder/previewHub'
import { initialsFor } from '../reportBuilder/presenceColor'

/** Props for {@link ReportPreviewScreen}. */
export interface ReportPreviewScreenProps {
  /**
   * The preview session id — the Report Template's id, taken from the route
   * (`#/report-preview/{sessionId}`). `null` when opened without one.
   */
  sessionId: string | null
  /** Bearer token used for the hub handshake. */
  accessToken?: string | null
  /** Returns to the Reports screen. */
  onClose: () => void
  /** Builds the hub; injectable for tests. Defaults to the live SignalR hub. */
  createHub?: (options: PreviewHubOptions) => PreviewHub
}

type Status = 'connecting' | 'live' | 'error'

/**
 * Live Report Template preview — a SiteAdmin watcher that shows the *real*, engine-rendered report and
 * updates as the template is built. It joins the template's preview session over SignalR
 * ({@link createPreviewHub}) and renders the page images the server pushes; opening it in a second tab
 * lets a SiteAdmin watch a report take shape while editing it in the Report Builder. A presence strip in
 * the header shows the other SiteAdmins taking part in the session.
 *
 * The editing source of truth is the Report Builder, which pushes the template's RDL; this screen only
 * watches. A watcher who opens mid-build is replayed the latest render at once (see ReportPreviewHub).
 */
export function ReportPreviewScreen({
  sessionId,
  accessToken,
  onClose,
  createHub = createPreviewHub,
}: ReportPreviewScreenProps) {
  const [pages, setPages] = useState<PreviewFrame[]>([])
  const [status, setStatus] = useState<Status>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<PreviewParticipant[]>([])
  const [connectionId, setConnectionId] = useState<string | null>(null)

  // Hold the latest token in a ref so the hub reads the current value without reconnecting on refresh.
  const tokenRef = useRef(accessToken)
  useEffect(() => {
    tokenRef.current = accessToken
  }, [accessToken])

  // The hub factory is an injection seam; hold it in a ref so re-renders (e.g. on each presence update)
  // don't tear down and rebuild the connection — it must depend only on the session.
  const createHubRef = useRef(createHub)
  useEffect(() => {
    createHubRef.current = createHub
  }, [createHub])

  useEffect(() => {
    if (!sessionId) return

    const hub = createHubRef.current({ accessTokenFactory: () => tokenRef.current ?? undefined })
    const offFrames = hub.onFrames((sid, received) => {
      if (sid !== sessionId) return
      setPages(received)
      setStatus('live')
      setError(null)
    })
    const offError = hub.onError((sid, message) => {
      if (sid === sessionId) setError(message)
    })
    const offParticipants = hub.onParticipants((sid, next) => {
      if (sid === sessionId) setParticipants(next)
    })
    hub.onReconnected(() => {
      // A reconnect is a fresh connection: re-join so the roster and frames resume.
      void hub
        .join(sessionId)
        .then(() => setConnectionId(hub.connectionId()))
        .catch(() => {})
    })

    // State resets per session via the `key` on this screen (see AppShell), so a fresh session
    // mounts fresh — no need to clear pages/status here.
    let cancelled = false
    hub
      .start()
      .then(() => hub.join(sessionId))
      .then(() => setConnectionId(hub.connectionId()))
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      offFrames()
      offError()
      offParticipants()
      void hub.stop()
    }
  }, [sessionId])

  const statusLabel =
    status === 'live' ? '● Live' : status === 'error' ? 'Disconnected' : 'Connecting…'

  // Show everyone else taking part; the local watcher is filtered out by its own connection id.
  const others = participants.filter((participant) => participant.connectionId !== connectionId)

  return (
    <div className="rp">
      <header className="rp-topbar">
        <button type="button" className="rb-crumb" aria-label="Back to Reports" onClick={onClose}>
          ‹ Reports
        </button>
        <span className="rp-title">Live preview{sessionId ? ` — ${sessionId}` : ''}</span>
        <span className={`rp-status rp-status-${status}`} role="status">
          {statusLabel}
        </span>
        {pages.length > 0 && (
          <span className="badge" aria-label="Page count">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </span>
        )}
        {others.length > 0 && (
          <div className="rp-presence" aria-label="Participants">
            {others.map((participant) => (
              <span
                key={participant.connectionId}
                className="rp-avatar"
                title={participant.displayName}
                style={{ backgroundColor: participant.color }}
              >
                {initialsFor(participant.displayName)}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="rp-body">
        {!sessionId ? (
          <p className="rp-empty">No report template selected.</p>
        ) : error ? (
          <p className="rp-empty rp-error">Could not render the preview: {error}</p>
        ) : pages.length === 0 ? (
          <p className="rp-empty">Waiting for the report to render…</p>
        ) : (
          <div className="rp-pages">
            {pages.map((page, i) => (
              <img
                key={i}
                className="rp-page"
                alt={`Page ${i + 1}`}
                src={`data:image/png;base64,${page}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
