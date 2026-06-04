import { useMemo, useState } from 'react'
import { ReportCanvas } from '../reportBuilder/ReportCanvas'
import { PropertiesPanel } from '../reportBuilder/PropertiesPanel'
import { StatusBar } from '../reportBuilder/StatusBar'
import { InsertPalette } from '../reportBuilder/InsertPalette'
import { InsertSheet } from '../reportBuilder/InsertSheet'
import { DEFAULT_ZOOM, zoomIn, zoomOut } from '../reportBuilder/geometry'
import {
  BAND_ORDER,
  addElement,
  bandKindOf,
  createElement,
  findElement,
  nextElementId,
  updateElement,
  type BandKind,
  type ElementType,
  type ReportElement,
  type ReportTemplate,
} from '../reportBuilder/model'
import { createSampleTemplate } from '../reportBuilder/sampleTemplate'

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [insertSheetOpen, setInsertSheetOpen] = useState(false)

  // Re-seed (and clear the selection) if the route's template id changes while
  // the builder stays mounted — the recommended "adjust state during render" form.
  const [loadedFor, setLoadedFor] = useState(templateId)
  if (templateId !== loadedFor) {
    setLoadedFor(templateId)
    setTemplate(createSampleTemplate(templateArg))
    setSelectedId(null)
  }

  const selected = useMemo(() => findElement(template, selectedId), [template, selectedId])

  // Merge a Properties-panel edit into the selected element.
  const handleEdit = (patch: Partial<ReportElement>) => {
    if (selectedId !== null) {
      setTemplate((current) => updateElement(current, selectedId, (el) => ({ ...el, ...patch })))
    }
  }

  // Insert a new element of the given type into the active band — the band of
  // the current selection, or the first band when nothing is selected — then
  // select it so it can be edited straight away.
  const handleInsert = (type: ElementType) => {
    const bandKind = bandKindOf(template, selectedId) ?? BAND_ORDER[0]
    const id = nextElementId(template, type)
    setTemplate(addElement(template, bandKind, createElement(type, id)))
    setSelectedId(id)
    setInsertSheetOpen(false)
  }

  // Insert a dragged palette item where it was dropped: into the dropped band at
  // the drop position (clamped to the band's top-left), then select it.
  const handleInsertAt = (type: ElementType, bandKind: BandKind, pos: { x: number; y: number }) => {
    const id = nextElementId(template, type)
    const element = createElement(type, id)
    const placed = { ...element, rect: { ...element.rect, x: Math.max(0, pos.x), y: Math.max(0, pos.y) } }
    setTemplate(addElement(template, bandKind, placed))
    setSelectedId(id)
  }

  // Reposition a placed element as it is dragged on the canvas.
  const handleMove = (id: string, pos: { x: number; y: number }) => {
    setTemplate((current) => updateElement(current, id, (el) => ({ ...el, rect: { ...el.rect, x: pos.x, y: pos.y } })))
  }

  return (
    <div className="rb">
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

      {/* Snap-to-grid and alignment controls are added in later phases. */}
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
              selectedId={selectedId}
              onSelectElement={setSelectedId}
              onInsertAt={handleInsertAt}
              onMoveElement={handleMove}
            />
          </section>
        </div>

        <aside className="rb-panel rb-properties" aria-label="Properties">
          <PropertiesPanel element={selected} onChange={handleEdit} />
        </aside>
      </div>

      <StatusBar selected={selected} zoom={zoom} />

      {insertSheetOpen && (
        <InsertSheet onClose={() => setInsertSheetOpen(false)} onInsert={handleInsert} />
      )}
    </div>
  )
}
