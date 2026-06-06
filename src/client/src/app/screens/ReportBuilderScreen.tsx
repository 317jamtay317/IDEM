import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ReportCanvas, type RemoteCursor } from '../reportBuilder/ReportCanvas'
import { LivePreviewPane } from '../reportBuilder/LivePreviewPane'
import { ReportPreview } from '../reportBuilder/ReportPreview'
import { PropertiesPanel } from '../reportBuilder/PropertiesPanel'
import { PageSetupEditor } from '../reportBuilder/PageSetupEditor'
import { StatusBar } from '../reportBuilder/StatusBar'
import { InsertPalette } from '../reportBuilder/InsertPalette'
import { InsertSheet } from '../reportBuilder/InsertSheet'
import { DEFAULT_ZOOM, zoomIn, zoomOut } from '../reportBuilder/geometry'
import {
  canRedo,
  canUndo,
  initHistory,
  record,
  redo,
  undo,
  type History,
} from '../reportBuilder/history'
import { pageCount } from '../reportBuilder/pageSetup'
import { fromDisplayPx, toDisplayPx } from '../reportBuilder/elementDisplay'
import { downloadText, openPdfInNewTab } from '../reportBuilder/download'
import { parseRdl, toRdl } from '../reportBuilder/rdl'
import {
  alignRects,
  distributeRects,
  type AlignEdge,
  type DistributeAxis,
} from '../reportBuilder/align'
import {
  BAND_ORDER,
  addElement,
  bandKindOf,
  createElement,
  findElement,
  nextElementId,
  removeElements,
  updateElement,
  updateElementRects,
  updatePage,
  updatePageNumbers,
  updateSettings,
  type BandKind,
  type ElementType,
  type PageNumberOptions,
  type PageSetup,
  type Rect,
  type ReportElement,
  type ReportTemplate,
} from '../reportBuilder/model'
import { createSampleTemplate } from '../reportBuilder/sampleTemplate'
import { type ReportTemplatesApi } from '../reportTemplatesApi'
import { usePreviewBroadcast } from '../reportBuilder/usePreviewBroadcast'
import { type PreviewHub, type PreviewHubOptions } from '../reportBuilder/previewHub'

/** The grid spacings (in display pixels) the toolbar offers; the model stores inches. */
const GRID_SIZE_OPTIONS_PX = [6, 12, 24]

/** The alignment toolbar actions, each with its edge, label and decorative glyph. */
const ALIGN_ACTIONS: { edge: AlignEdge; label: string; icon: string }[] = [
  { edge: 'left', label: 'Align left', icon: '⇤' },
  { edge: 'center', label: 'Align center', icon: '⇔' },
  { edge: 'right', label: 'Align right', icon: '⇥' },
  { edge: 'top', label: 'Align top', icon: '⤒' },
  { edge: 'middle', label: 'Align middle', icon: '⇕' },
  { edge: 'bottom', label: 'Align bottom', icon: '⤓' },
]

/** The distribution toolbar actions, each with its axis, label and decorative glyph. */
const DISTRIBUTE_ACTIONS: { axis: DistributeAxis; label: string; icon: string }[] = [
  { axis: 'horizontal', label: 'Distribute horizontally', icon: '⇿' },
  { axis: 'vertical', label: 'Distribute vertically', icon: '⤢' },
]

/** Props for {@link ReportBuilderScreen}. */
export interface ReportBuilderScreenProps {
  /**
   * Id of the Report Template being edited, taken from the route
   * (`#/report-builder/{templateId}`); `'new'` (or `null`) opens a fresh template.
   * In online mode (see {@link ReportBuilderScreenProps.api}) a real id is loaded
   * from the backend; offline it stands in for the document name in the title.
   */
  templateId: string | null
  /** Returns to the Reports screen, the builder's parent. */
  onClose: () => void
  /**
   * Report Template persistence. When supplied (online mode) the builder loads an
   * existing template from the backend, Save persists it (create/update), and a
   * "Download PDF" action renders it through the server-side Report Engine. When
   * omitted (offline — the design/test default) the builder works against a sample
   * template and Save downloads the RDL.
   */
  api?: ReportTemplatesApi
  /**
   * Bearer access token. Authorizes Report Template requests (online mode) and the live-preview SignalR
   * hub; when present, the editor broadcasts edits over SignalR (so a watcher sees the report build) and
   * takes part in live collaboration (presence + advisory locks). Absent (e.g. in tests) both are inactive.
   */
  accessToken?: string | null
  /** Builds the live-preview/collaboration hub; injectable for tests. Defaults to the live SignalR hub. */
  createHub?: (options: PreviewHubOptions) => PreviewHub
  /**
   * Called after a brand-new template is saved, with its persisted id, so the parent
   * can move the route from `'new'` to the real id (turning later saves into updates).
   */
  onSaved?: (templateId: string) => void
}

/**
 * Report Builder — the SiteAdmin designer that authors a Report Template (see
 * UbiquitousLanguage "Report Builder"). A top bar (document title with
 * Undo/Redo/Preview/Save), a tools toolbar with the zoom control, and the
 * three-region workspace — an Insert palette, the report canvas, and a
 * Properties panel.
 *
 * The {@link ReportCanvas} draws the template's bands and elements at a zoom the
 * toolbar controls; clicking an element selects it, reflecting it in the
 * {@link PropertiesPanel} and {@link StatusBar} (Phase 3) and letting the panel
 * edit it (Phase 4). The {@link InsertPalette} adds new elements to the active
 * band — the band of the current selection, or the first band when nothing is
 * selected (Phase 5). Until backend persistence (Phase 13) exists, the working
 * document is a sample template (see {@link createSampleTemplate}).
 *
 * Mobile-first: the regions stack on a phone — where the palette is reached
 * through a `+ Insert` bottom sheet ({@link InsertSheet}) — and become a
 * three-column workspace on desktop.
 */
export function ReportBuilderScreen({
  templateId,
  onClose,
  api,
  accessToken = null,
  createHub,
  onSaved,
}: ReportBuilderScreenProps) {
  // Online mode talks to the backend; offline (no api) works against a sample.
  const online = api != null
  const isNew = templateId == null || templateId === 'new'
  const templateArg = isNew ? undefined : templateId ?? undefined
  const documentTitle = templateId ?? 'Untitled report template'

  // The working document is held in an undo/redo history so edits can be reversed
  // (Phase 12). A fresh template (and the offline default) seed synchronously from a
  // sample; an existing online template is fetched by the effect below, so it starts
  // from a placeholder until it loads.
  const [history, setHistory] = useState<History<ReportTemplate>>(() =>
    initHistory(createSampleTemplate(templateArg)),
  )
  const template = history.present
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [insertSheetOpen, setInsertSheetOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [livePreviewOpen, setLivePreviewOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Online persistence status: loading an existing template, saving, and any error.
  const [loading, setLoading] = useState(online && !isNew)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Commit an edit to the working document, recording it in history. A `tag`
  // coalesces the many model updates of one live gesture (drag/resize/inline edit)
  // into a single undo step; discrete edits are left untagged (one step each).
  const commit = (
    next: ReportTemplate | ((prev: ReportTemplate) => ReportTemplate),
    tag?: string,
  ) => setHistory((h) => record(h, typeof next === 'function' ? next(h.present) : next, tag))

  // Re-seed (and reset the selection and current page) if the route's template id
  // changes while the builder stays mounted — the "adjust state during render" form.
  // Offline (or a new template) re-seeds from the sample here; an existing online
  // template is re-seeded from the backend by the load effect below.
  const [loadedFor, setLoadedFor] = useState(templateId)
  if (templateId !== loadedFor) {
    setLoadedFor(templateId)
    if (!online || isNew) {
      setHistory(initHistory(createSampleTemplate(templateArg)))
    } else {
      setLoading(true)
    }
    setLoadError(null)
    setSelectedIds([])
    setCurrentPage(1)
  }

  // Load an existing template from the backend (online mode). New templates and the
  // offline default skip the fetch and keep their sample seed. The "loading" flag is
  // primed synchronously — by the initial state on mount and by the re-seed block
  // above on an id change — so this effect only writes state from its async result.
  useEffect(() => {
    if (!online || isNew) return
    let cancelled = false
    api
      .get(accessToken, templateId as string)
      .then((saved) => {
        if (cancelled) return
        setHistory(initHistory(parseRdl(saved.rdl)))
        setSelectedIds([])
        setCurrentPage(1)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(String(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [online, isNew, templateId, accessToken, api])

  // Page breaks drive the page count; if a break is removed while a later page is
  // in view, clamp the current page back into range (also "adjust during render").
  const pages = pageCount(template)
  if (currentPage > pages) setCurrentPage(pages)

  // The Properties/Status panels edit a single element; they show it only when
  // exactly one is selected (a multi-selection summarises by count instead).
  const soleId = selectedIds.length === 1 ? selectedIds[0] : null
  const selected = useMemo(() => findElement(template, soleId), [template, soleId])

  // Serialize the working document to RDL and broadcast it to the live preview as the SiteAdmin builds
  // (debounced); also take part in live collaboration (presence + advisory locks). Inactive without an
  // access token (e.g. in tests). See usePreviewBroadcast.
  const rdl = useMemo(() => toRdl(template), [template])
  const {
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
  } = usePreviewBroadcast({
    sessionId: template.id,
    rdl,
    accessToken,
    selectedIds,
    createHub,
  })

  // Other participants' live selections and the advisory locks they hold, projected for the canvas to
  // overlay (the local editor is filtered out by its own connection id). A lock is shown in its holder's
  // colour, looked up from the roster.
  const participantByConnection = useMemo(
    () => new Map(participants.map((participant) => [participant.connectionId, participant])),
    [participants],
  )
  const colorByConnection = useMemo(
    () => new Map(participants.map((participant) => [participant.connectionId, participant.color])),
    [participants],
  )
  const remoteSelections = useMemo(
    () =>
      participants
        .filter((participant) => participant.connectionId !== connectionId)
        .flatMap((participant) =>
          participant.selectedElementIds.map((elementId) => ({
            elementId,
            color: participant.color,
            label: participant.displayName,
          })),
        ),
    [participants, connectionId],
  )
  const remoteLocks = useMemo(
    () =>
      locks
        .filter((lock) => lock.connectionId !== connectionId)
        .map((lock) => ({
          elementId: lock.elementId,
          color: colorByConnection.get(lock.connectionId) ?? 'var(--color-text-muted)',
          label: lock.displayName,
        })),
    [locks, connectionId, colorByConnection],
  )
  // Other participants' live cursors, joined with the roster for each one's colour and name (a cursor
  // whose participant is not in the roster — e.g. just left — is dropped). The local cursor is filtered out.
  const remoteCursors = useMemo<RemoteCursor[]>(
    () =>
      cursors
        .filter((cursor) => cursor.connectionId !== connectionId)
        .flatMap((cursor) => {
          const participant = participantByConnection.get(cursor.connectionId)
          return participant
            ? [{ connectionId: cursor.connectionId, x: cursor.x, y: cursor.y, color: participant.color, label: participant.displayName }]
            : []
        }),
    [cursors, connectionId, participantByConnection],
  )

  // Hold an advisory soft-lock on the element being worked on — the sole selection — so other
  // participants see "being edited by …". Releasing the previous one as the selection moves; a
  // multi- or empty selection holds nothing. No-op without an active (authenticated) connection.
  const claimedRef = useRef<string | null>(null)
  useEffect(() => {
    if (claimedRef.current === soleId) return
    if (claimedRef.current) release(claimedRef.current)
    if (soleId) claim(soleId)
    claimedRef.current = soleId
  }, [soleId, claim, release])

  // Change the selection: a plain click replaces it with one element, a modified
  // (Shift/Ctrl/Cmd) click toggles that element in or out, and an empty-canvas
  // click clears it.
  const handleSelect = (id: string | null, additive: boolean) => {
    if (id === null) {
      setSelectedIds([])
      return
    }
    setSelectedIds((current) =>
      additive ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id],
    )
  }

  // Replace the selection with the elements a marquee (rubber-band) drag covered.
  const handleMarqueeSelect = (ids: string[]) => setSelectedIds(ids)

  // Merge a Properties-panel edit into the sole selected element.
  const handleEdit = (patch: Partial<ReportElement>) => {
    if (soleId !== null) {
      commit((current) => updateElement(current, soleId, (el) => ({ ...el, ...patch })))
    }
  }

  // Apply a geometry transform (align or distribute) to every selected element's
  // rect at once, writing the results back across bands in one immutable update.
  const arrangeSelection = (transform: (rects: Rect[]) => Rect[]) => {
    const elements = selectedIds
      .map((id) => findElement(template, id))
      .filter((el): el is ReportElement => el !== null)
    const rects = transform(elements.map((el) => el.rect))
    commit(updateElementRects(template, new Map(elements.map((el, i) => [el.id, rects[i]]))))
  }

  const handleAlign = (edge: AlignEdge) => arrangeSelection((rects) => alignRects(rects, edge))
  const handleDistribute = (axis: DistributeAxis) =>
    arrangeSelection((rects) => distributeRects(rects, axis))

  // Insert a new element of the given type into the active band — the band of
  // the current selection, or the first band when nothing is selected — then
  // select it so it can be edited straight away.
  const handleInsert = (type: ElementType) => {
    const bandKind = bandKindOf(template, selectedIds[0] ?? null) ?? BAND_ORDER[0]
    const id = nextElementId(template, type)
    commit(addElement(template, bandKind, createElement(type, id)))
    setSelectedIds([id])
    setInsertSheetOpen(false)
  }

  // Insert a dragged palette item where it was dropped: into the dropped band at
  // the drop position (clamped to the band's top-left), then select it.
  const handleInsertAt = (type: ElementType, bandKind: BandKind, pos: { x: number; y: number }) => {
    const id = nextElementId(template, type)
    const element = createElement(type, id)
    const placed = { ...element, rect: { ...element.rect, x: Math.max(0, pos.x), y: Math.max(0, pos.y) } }
    commit(addElement(template, bandKind, placed))
    setSelectedIds([id])
  }

  // Reposition a placed element as it is dragged on the canvas. The whole drag
  // coalesces into one undo step (tagged by the moved element's id).
  const handleMove = (id: string, pos: { x: number; y: number }) => {
    commit(
      (current) => updateElement(current, id, (el) => ({ ...el, rect: { ...el.rect, x: pos.x, y: pos.y } })),
      `move:${id}`,
    )
  }

  // Resize a placed element as a corner handle is dragged (one undo step per drag).
  const handleResize = (id: string, rect: Rect) => {
    commit((current) => updateElement(current, id, (el) => ({ ...el, rect })), `resize:${id}`)
  }

  // Commit an inline (on-canvas, double-click) text edit to the element. Typing
  // coalesces into one undo step (tagged by the edited element's id).
  const handleEditText = (id: string, text: string) => {
    commit((current) => updateElement(current, id, (el) => ({ ...el, text })), `text:${id}`)
  }

  // Turn snap-to-grid on or off.
  const handleToggleSnap = () => {
    commit((current) => updateSettings(current, { snapToGrid: !current.settings.snapToGrid }))
  }

  // Change the grid spacing (the select offers display pixels; the model is inches).
  const handleGridSize = (px: number) => {
    commit((current) => updateSettings(current, { gridSize: fromDisplayPx(px) }))
  }

  // Edit the page setup (size, orientation, margins) from the Page Setup panel.
  const handlePageChange = (patch: Partial<PageSetup>) => {
    commit((current) => updatePage(current, patch))
  }

  // Edit the footer page-number options from the Page Setup panel (Phase 11).
  const handlePageNumbersChange = (patch: Partial<PageNumberOptions>) => {
    commit((current) => updatePageNumbers(current, patch))
  }

  // Resize the page by dragging its edge/corner grips on the canvas (one undo step).
  const handleResizePage = (size: { width: number; height: number }) => {
    commit((current) => updatePage(current, size), 'resize-page')
  }

  // Step the page navigator within the available pages.
  const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1))
  const handleNextPage = () => setCurrentPage((p) => Math.min(pages, p + 1))

  // Rename the working template (online mode shows an editable name). Typing
  // coalesces into a single undo step.
  const handleRename = (name: string) => commit((current) => ({ ...current, name }), 'rename')

  // Save the template. Offline, download it as RDL (the design/test default). Online,
  // persist it: create a brand-new template (reporting its id to the parent so the
  // route can switch from 'new' to the real id) or update the existing one.
  const handleSave = async () => {
    if (!online) {
      downloadText(`${template.name}.rdl`, toRdl(template), 'application/xml')
      return
    }
    setSaving(true)
    setStatusError(null)
    try {
      const rdl = toRdl(template)
      if (isNew) {
        const created = await api.create(accessToken, { name: template.name, rdl })
        onSaved?.(created.id)
      } else {
        await api.update(accessToken, templateId as string, { name: template.name, rdl })
      }
    } catch (e) {
      setStatusError(String(e))
    } finally {
      setSaving(false)
    }
  }

  // Render the working template to a PDF through the server-side Report Engine and
  // open it (online only) — the most direct way to exercise the RDL→PDF pipeline.
  const handleDownloadPdf = async () => {
    if (!online) return
    setStatusError(null)
    try {
      const blob = await api.renderPdf(accessToken, toRdl(template))
      openPdfInNewTab(blob)
    } catch (e) {
      setStatusError(String(e))
    }
  }

  // Delete the selected element(s) from the template and clear the selection.
  const handleDelete = () => {
    if (selectedIds.length === 0) return
    commit((current) => removeElements(current, selectedIds))
    setSelectedIds([])
  }

  // Delete / Backspace removes the selection — unless focus is in a form field,
  // where those keys edit text rather than delete the element.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }
    if (selectedIds.length === 0) return
    e.preventDefault()
    handleDelete()
  }

  // While an existing template is being fetched (or if it failed to load), show a
  // minimal shell so the sample placeholder never flashes as the real document.
  if (online && !isNew && (loading || loadError !== null)) {
    return (
      <div className="rb">
        <header className="rb-topbar">
          <div className="rb-breadcrumb">
            <button type="button" className="rb-crumb" aria-label="Back to Reports" onClick={onClose}>
              ‹ Reports
            </button>
            <span className="rb-doc-title">{loadError ? 'Failed to load template' : 'Loading…'}</span>
          </div>
        </header>
        {loadError ? (
          <div className="auth-alert rb-load-error">Error: {loadError}</div>
        ) : (
          <p className="muted rb-loading">Loading report template…</p>
        )}
      </div>
    )
  }

  return (
    <div className="rb" onKeyDown={handleKeyDown}>
      <header className="rb-topbar">
        <div className="rb-breadcrumb">
          <button type="button" className="rb-crumb" aria-label="Back to Reports" onClick={onClose}>
            ‹ Reports
          </button>
          {online ? (
            <input
              type="text"
              className="rb-doc-title-input"
              aria-label="Report name"
              value={template.name}
              onChange={(e) => handleRename(e.target.value)}
            />
          ) : (
            <span className="rb-doc-title">{documentTitle}</span>
          )}
          <span className="badge">Template</span>
        </div>

        <div className="rb-actions">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(history)}
            onClick={() => setHistory(undo)}
          >
            Undo
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(history)}
            onClick={() => setHistory(redo)}
          >
            Redo
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => setPreviewOpen(true)}
          >
            Preview
          </button>
          {online && (
            <button
              type="button"
              className="button button-secondary button-sm"
              aria-label="Download PDF"
              onClick={handleDownloadPdf}
            >
              PDF
            </button>
          )}
          <button
            type="button"
            className={`button button-secondary button-sm${livePreviewOpen ? ' rb-action-active' : ''}`}
            aria-pressed={livePreviewOpen}
            onClick={() => setLivePreviewOpen((open) => !open)}
          >
            Live preview
          </button>
          <button
            type="button"
            className="button button-primary button-sm"
            onClick={handleSave}
            disabled={online && saving}
          >
            Save
          </button>
        </div>
      </header>

      {online && statusError && (
        <div className="auth-alert rb-status-error">Error: {statusError}</div>
      )}

      <div className="rb-toolbar" role="toolbar" aria-label="Report builder tools">
        <div className="rb-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="button button-secondary button-sm"
            aria-label="Zoom out"
            onClick={() => setZoom(zoomOut)}
          >
            −
          </button>
          <span className="rb-zoom-level" aria-live="polite">
            {zoom}%
          </span>
          <button
            type="button"
            className="button button-secondary button-sm"
            aria-label="Zoom in"
            onClick={() => setZoom(zoomIn)}
          >
            +
          </button>
        </div>

        {/* Page navigator: step through the pages the page breaks define (Phase 10). */}
        <div className="rb-pages" role="group" aria-label="Pages">
          <button
            type="button"
            className="button button-secondary button-sm"
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={handlePrevPage}
          >
            ‹
          </button>
          <span className="rb-page-indicator" aria-live="polite">
            Page {currentPage} / {pages}
          </span>
          <button
            type="button"
            className="button button-secondary button-sm"
            aria-label="Next page"
            disabled={currentPage >= pages}
            onClick={handleNextPage}
          >
            ›
          </button>
        </div>

        {/* Snap-to-grid: a toggle plus the grid spacing (Phase 7). */}
        <div className="rb-snap" role="group" aria-label="Grid">
          <button
            type="button"
            className={`rb-toggle${template.settings.snapToGrid ? ' rb-toggle-active' : ''}`}
            aria-label="Snap to grid"
            aria-pressed={template.settings.snapToGrid}
            onClick={handleToggleSnap}
          >
            Snap
          </button>
          <select
            className="rb-grid-size"
            aria-label="Grid size"
            value={toDisplayPx(template.settings.gridSize)}
            onChange={(e) => handleGridSize(Number(e.target.value))}
          >
            {GRID_SIZE_OPTIONS_PX.map((px) => (
              <option key={px} value={px}>
                {px} px
              </option>
            ))}
          </select>
        </div>

        {/* Align & distribute the selection (Phase 8). Aligning needs two
            elements, distributing three. */}
        <div className="rb-align" role="group" aria-label="Arrange">
          {ALIGN_ACTIONS.map(({ edge, label, icon }) => (
            <button
              key={edge}
              type="button"
              className="rb-toggle"
              aria-label={label}
              title={label}
              disabled={selectedIds.length < 2}
              onClick={() => handleAlign(edge)}
            >
              <span aria-hidden="true">{icon}</span>
            </button>
          ))}
          {DISTRIBUTE_ACTIONS.map(({ axis, label, icon }) => (
            <button
              key={axis}
              type="button"
              className="rb-toggle"
              aria-label={label}
              title={label}
              disabled={selectedIds.length < 3}
              onClick={() => handleDistribute(axis)}
            >
              <span aria-hidden="true">{icon}</span>
            </button>
          ))}
        </div>

        {/* Delete the selected element(s); also bound to the Delete/Backspace key. */}
        <button
          type="button"
          className="button button-secondary button-sm rb-delete"
          title="Delete"
          disabled={selectedIds.length === 0}
          onClick={handleDelete}
        >
          Delete
        </button>

        {/* Phone entry point to the Insert palette; the desktop sidebar replaces
            it at wider widths. */}
        <button
          type="button"
          className="button button-secondary button-sm rb-insert-trigger"
          onClick={() => setInsertSheetOpen(true)}
        >
          + Insert
        </button>
      </div>

      <div className="rb-body">
        <section className="rb-panel rb-palette" aria-label="Insert">
          <span className="overline">Insert</span>
          <InsertPalette compact onInsert={handleInsert} />
        </section>

        <div className="rb-canvas-wrap">
          <section className="rb-canvas" aria-label="Report canvas">
            <ReportCanvas
              template={template}
              zoom={zoom}
              selectedIds={selectedIds}
              onSelectElement={handleSelect}
              onMarqueeSelect={handleMarqueeSelect}
              onInsertAt={handleInsertAt}
              onMoveElement={handleMove}
              onResize={handleResize}
              onEditText={handleEditText}
              onResizePage={handleResizePage}
              remoteSelections={remoteSelections}
              locks={remoteLocks}
              remoteCursors={remoteCursors}
              onCursorMove={publishCursor}
            />
          </section>

          {/* Side-by-side live preview: the engine-rendered report, updating as anyone edits (the editor is
              in the session group, so its own pushes — and other participants' — return as frames here). */}
          {livePreviewOpen && (
            <aside className="rb-panel rb-live-preview" aria-label="Live preview">
              <LivePreviewPane
                pages={frames}
                status={previewStatus}
                renderError={previewError}
                participants={participants}
                selfConnectionId={connectionId}
                title="Live preview"
                onClose={() => setLivePreviewOpen(false)}
                closeAriaLabel="Hide live preview"
                closeText="✕"
              />
            </aside>
          )}
        </div>

        <aside className="rb-panel rb-properties" aria-label="Properties">
          {selectedIds.length === 0 ? (
            <PageSetupEditor
              page={template.page}
              onChange={handlePageChange}
              pageNumbers={template.pageNumbers}
              onPageNumbersChange={handlePageNumbersChange}
            />
          ) : (
            <PropertiesPanel element={selected} selectedCount={selectedIds.length} onChange={handleEdit} />
          )}
        </aside>
      </div>

      <StatusBar
        selected={selected}
        selectedCount={selectedIds.length}
        zoom={zoom}
        currentPage={currentPage}
        pageCount={pages}
        snapToGrid={template.settings.snapToGrid}
        gridSize={template.settings.gridSize}
      />

      {insertSheetOpen && (
        <InsertSheet onClose={() => setInsertSheetOpen(false)} onInsert={handleInsert} />
      )}

      {previewOpen && <ReportPreview template={template} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}
