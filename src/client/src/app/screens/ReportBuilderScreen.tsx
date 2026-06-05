import { useMemo, useState, type KeyboardEvent } from 'react'
import { ReportCanvas } from '../reportBuilder/ReportCanvas'
import { PropertiesPanel } from '../reportBuilder/PropertiesPanel'
import { PageSetupEditor } from '../reportBuilder/PageSetupEditor'
import { StatusBar } from '../reportBuilder/StatusBar'
import { InsertPalette } from '../reportBuilder/InsertPalette'
import { InsertSheet } from '../reportBuilder/InsertSheet'
import { DEFAULT_ZOOM, zoomIn, zoomOut } from '../reportBuilder/geometry'
import { pageCount } from '../reportBuilder/pageSetup'
import { fromDisplayPx, toDisplayPx } from '../reportBuilder/elementDisplay'
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
  updateSettings,
  type BandKind,
  type ElementType,
  type PageSetup,
  type Rect,
  type ReportElement,
  type ReportTemplate,
} from '../reportBuilder/model'
import { createSampleTemplate } from '../reportBuilder/sampleTemplate'

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
   * (`#/report-builder/{templateId}`); `null` when the builder is opened without
   * one. Until a later phase can load a Template from the backend, the id stands
   * in for the document name shown in the title.
   */
  templateId: string | null
  /** Returns to the Reports screen, the builder's parent. */
  onClose: () => void
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
export function ReportBuilderScreen({ templateId, onClose }: ReportBuilderScreenProps) {
  const documentTitle = templateId ?? 'Untitled report template'
  const templateArg = templateId && templateId !== 'new' ? templateId : undefined

  // The working document is held in state so property edits persist. It's a
  // stand-in sample until templates can be loaded from the backend (Phase 13).
  const [template, setTemplate] = useState<ReportTemplate>(() => createSampleTemplate(templateArg))
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [insertSheetOpen, setInsertSheetOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // Re-seed (and reset the selection and current page) if the route's template id
  // changes while the builder stays mounted — the "adjust state during render" form.
  const [loadedFor, setLoadedFor] = useState(templateId)
  if (templateId !== loadedFor) {
    setLoadedFor(templateId)
    setTemplate(createSampleTemplate(templateArg))
    setSelectedIds([])
    setCurrentPage(1)
  }

  // Page breaks drive the page count; if a break is removed while a later page is
  // in view, clamp the current page back into range (also "adjust during render").
  const pages = pageCount(template)
  if (currentPage > pages) setCurrentPage(pages)

  // The Properties/Status panels edit a single element; they show it only when
  // exactly one is selected (a multi-selection summarises by count instead).
  const soleId = selectedIds.length === 1 ? selectedIds[0] : null
  const selected = useMemo(() => findElement(template, soleId), [template, soleId])

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
      setTemplate((current) => updateElement(current, soleId, (el) => ({ ...el, ...patch })))
    }
  }

  // Apply a geometry transform (align or distribute) to every selected element's
  // rect at once, writing the results back across bands in one immutable update.
  const arrangeSelection = (transform: (rects: Rect[]) => Rect[]) => {
    const elements = selectedIds
      .map((id) => findElement(template, id))
      .filter((el): el is ReportElement => el !== null)
    const rects = transform(elements.map((el) => el.rect))
    setTemplate(updateElementRects(template, new Map(elements.map((el, i) => [el.id, rects[i]]))))
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
    setTemplate(addElement(template, bandKind, createElement(type, id)))
    setSelectedIds([id])
    setInsertSheetOpen(false)
  }

  // Insert a dragged palette item where it was dropped: into the dropped band at
  // the drop position (clamped to the band's top-left), then select it.
  const handleInsertAt = (type: ElementType, bandKind: BandKind, pos: { x: number; y: number }) => {
    const id = nextElementId(template, type)
    const element = createElement(type, id)
    const placed = { ...element, rect: { ...element.rect, x: Math.max(0, pos.x), y: Math.max(0, pos.y) } }
    setTemplate(addElement(template, bandKind, placed))
    setSelectedIds([id])
  }

  // Reposition a placed element as it is dragged on the canvas.
  const handleMove = (id: string, pos: { x: number; y: number }) => {
    setTemplate((current) => updateElement(current, id, (el) => ({ ...el, rect: { ...el.rect, x: pos.x, y: pos.y } })))
  }

  // Resize a placed element as a corner handle is dragged.
  const handleResize = (id: string, rect: Rect) => {
    setTemplate((current) => updateElement(current, id, (el) => ({ ...el, rect })))
  }

  // Commit an inline (on-canvas, double-click) text edit to the element.
  const handleEditText = (id: string, text: string) => {
    setTemplate((current) => updateElement(current, id, (el) => ({ ...el, text })))
  }

  // Turn snap-to-grid on or off.
  const handleToggleSnap = () => {
    setTemplate((current) => updateSettings(current, { snapToGrid: !current.settings.snapToGrid }))
  }

  // Change the grid spacing (the select offers display pixels; the model is inches).
  const handleGridSize = (px: number) => {
    setTemplate((current) => updateSettings(current, { gridSize: fromDisplayPx(px) }))
  }

  // Edit the page setup (size, orientation, margins) from the Page Setup panel.
  const handlePageChange = (patch: Partial<PageSetup>) => {
    setTemplate((current) => updatePage(current, patch))
  }

  // Step the page navigator within the available pages.
  const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1))
  const handleNextPage = () => setCurrentPage((p) => Math.min(pages, p + 1))

  // Delete the selected element(s) from the template and clear the selection.
  const handleDelete = () => {
    if (selectedIds.length === 0) return
    setTemplate((current) => removeElements(current, selectedIds))
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

  return (
    <div className="rb" onKeyDown={handleKeyDown}>
      <header className="rb-topbar">
        <div className="rb-breadcrumb">
          <button type="button" className="rb-crumb" aria-label="Back to Reports" onClick={onClose}>
            ‹ Reports
          </button>
          <span className="rb-doc-title">{documentTitle}</span>
          <span className="badge">Template</span>
        </div>

        <div className="rb-actions">
          <button type="button" className="button button-secondary button-sm" disabled>
            Undo
          </button>
          <button type="button" className="button button-secondary button-sm" disabled>
            Redo
          </button>
          <button type="button" className="button button-secondary button-sm">
            Preview
          </button>
          <button type="button" className="button button-primary button-sm">
            Save
          </button>
        </div>
      </header>

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
            />
          </section>
        </div>

        <aside className="rb-panel rb-properties" aria-label="Properties">
          {selectedIds.length === 0 ? (
            <PageSetupEditor page={template.page} onChange={handlePageChange} />
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
    </div>
  )
}
