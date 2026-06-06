import { type PreviewFrame, type PreviewParticipant } from './previewHub'
import { initialsFor } from './presenceColor'
import { type PreviewStatus } from './usePreviewBroadcast'

/** Props for {@link LivePreviewPane}. */
export interface LivePreviewPaneProps {
  /** The rendered page images to show, in order (each a base64-encoded PNG). */
  pages: PreviewFrame[]
  /** The live-preview connection state, shown as a status indicator. */
  status: PreviewStatus
  /** A render error for the session, if the pushed RDL could not be rendered. */
  renderError?: string | null
  /** Everyone in the session; the local participant is filtered out of the presence strip by its id. */
  participants?: PreviewParticipant[]
  /** This view's own connection id, so it is excluded from the presence strip. */
  selfConnectionId?: string | null
  /** The pane's title (e.g. "Live preview"). */
  title?: string
  /** The message shown while there is nothing to render yet (defaults to a generic waiting message). */
  waitingLabel?: string
  /** Closes/hides the pane. Omit to render no close control. */
  onClose?: () => void
  /** The close control's accessible label (e.g. "Back to Reports", "Hide live preview"). */
  closeAriaLabel?: string
  /** The close control's visible content (e.g. "‹ Reports", "✕"). */
  closeText?: string
}

/**
 * The visual surface of the live Report Template preview: a header (close control, title, connection
 * status, page count, and a presence strip of the other SiteAdmins in the session) above the engine-rendered
 * page images. Purely presentational — it holds no hub connection, so it can be the full-screen watcher
 * ({@link ReportPreviewScreen}) or a side-by-side pane inside the Report Builder, both fed by the same
 * frames. A watcher who opens mid-build sees the latest frames at once; until the first frame arrives it
 * shows {@link LivePreviewPaneProps.waitingLabel}.
 */
export function LivePreviewPane({
  pages,
  status,
  renderError = null,
  participants = [],
  selfConnectionId = null,
  title = 'Live preview',
  waitingLabel = 'Waiting for the report to render…',
  onClose,
  closeAriaLabel = 'Close',
  closeText = '✕',
}: LivePreviewPaneProps) {
  const statusLabel = status === 'live' ? '● Live' : status === 'error' ? 'Disconnected' : 'Connecting…'

  // Show everyone else taking part; the local view is filtered out by its own connection id.
  const others = participants.filter((participant) => participant.connectionId !== selfConnectionId)

  return (
    <>
      <header className="rp-topbar">
        {onClose && (
          <button type="button" className="rb-crumb" aria-label={closeAriaLabel} onClick={onClose}>
            {closeText}
          </button>
        )}
        <span className="rp-title">{title}</span>
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
        {renderError ? (
          <p className="rp-empty rp-error">Could not render the preview: {renderError}</p>
        ) : pages.length === 0 ? (
          <p className="rp-empty">{waitingLabel}</p>
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
    </>
  )
}
