/**
 * The read-only render of a {@link ReportTemplate}: a white page surface holding
 * the report bands stacked top to bottom, each band carrying its elements at
 * their authored positions. Geometry comes from the model in inches and is
 * converted to pixels at the current zoom (see {@link inchesToPx}). Binding
 * tokens (e.g. `{Record.Tons}`) are shown verbatim here; they are resolved to
 * data only at preview time (a later phase). Selection and editing arrive in
 * Phases 3–6.
 */
import { Fragment, useRef, type DragEvent, type PointerEvent } from 'react'
import { BAND_LABELS } from './bandLabels'
import { ELEMENT_DRAG_MIME, isElementType } from './dnd'
import { ELEMENT_TYPE_LABELS } from './elementDisplay'
import { elementTextCss } from './elementStyleCss'
import { draggedPosition, inchesToPx, pxToInches, resizedRect, type ResizeHandle } from './geometry'
import { type BandKind, type ElementType, type Rect, type ReportElement, type ReportTemplate } from './model'

/** The corner resize handles, with the accessible label shown for each. */
const RESIZE_HANDLES: { handle: ResizeHandle; label: string }[] = [
  { handle: 'nw', label: 'top-left' },
  { handle: 'ne', label: 'top-right' },
  { handle: 'sw', label: 'bottom-left' },
  { handle: 'se', label: 'bottom-right' },
]

/** The text shown for an element on the read-only canvas. */
function elementContent(el: ReportElement): string {
  switch (el.type) {
    case 'line':
    case 'rectangle':
    case 'triangle':
    case 'ellipse':
      return '' // drawn purely with CSS; no text
    case 'image':
    case 'barcode':
    case 'subReport':
    case 'table':
    case 'chart':
    case 'pageBreak':
      return ELEMENT_TYPE_LABELS[el.type] // placeholder block labelled with its kind
    default:
      return el.text ?? el.expression ?? ''
  }
}

/** Props for {@link ReportCanvas}. */
export interface ReportCanvasProps {
  /** The template to render. */
  template: ReportTemplate
  /** The canvas zoom, as a percentage (100 = actual size). */
  zoom: number
  /** The ids of the currently selected elements (empty when nothing is selected). */
  selectedIds?: string[]
  /**
   * Called when the selection changes: the clicked element's id, or `null` when
   * the empty canvas is clicked (deselect). `additive` is `true` when a modifier
   * (Shift/Ctrl/Cmd) was held, meaning the element should be toggled in or out of
   * the current selection rather than replacing it. Omit to render a
   * non-interactive canvas.
   */
  onSelectElement?: (id: string | null, additive: boolean) => void
  /**
   * Called when a palette item is dropped onto a band: the dropped element type,
   * the band it landed in, and the drop position within that band, in inches.
   * Omit to disable dropping onto the canvas.
   */
  onInsertAt?: (type: ElementType, bandKind: BandKind, position: { x: number; y: number }) => void
  /**
   * Called as a placed element is dragged to a new position within its band: the
   * element's id and its new top-left, in inches. Omit to make elements
   * select-only (not movable).
   */
  onMoveElement?: (id: string, position: { x: number; y: number }) => void
  /**
   * Called as the selected element is resized by dragging a corner handle: the
   * element's id and its new rect, in inches. Omit to hide the resize handles.
   */
  onResize?: (id: string, rect: Rect) => void
}

/**
 * Renders a Report Template as a banded page at the given zoom. The page width
 * tracks the template's page setup; each band is a labelled region sized to its
 * height, and each element is an absolutely positioned, selectable control.
 * Clicking an element selects it; clicking the empty page deselects. The render
 * is otherwise a faithful, read-only picture of the template.
 */
export function ReportCanvas({
  template,
  zoom,
  selectedIds = [],
  onSelectElement,
  onInsertAt,
  onMoveElement,
  onResize,
}: ReportCanvasProps) {
  const px = (inches: number) => `${inchesToPx(inches, zoom)}px`
  const { snapToGrid, gridSize } = template.settings

  // Resize handles are a single-element affordance: shown only when exactly one
  // element is selected.
  const soleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null

  // The element being dragged: its id and the anchor (its start position plus the
  // pointer's start point) from which each move computes an absolute new position.
  const drag = useRef<{ id: string; startX: number; startY: number; pointerX: number; pointerY: number } | null>(null)

  // Begin a drag (and select) when an element is pressed with the primary button.
  // A modified press (Shift/Ctrl/Cmd) toggles the element in the selection and
  // does not start a drag — the user is building a multi-selection, not moving.
  const handlePointerDown = (el: ReportElement) => (e: PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const additive = e.shiftKey || e.metaKey || e.ctrlKey
    onSelectElement?.(el.id, additive)
    if (additive || !onMoveElement) return
    drag.current = { id: el.id, startX: el.rect.x, startY: el.rect.y, pointerX: e.clientX, pointerY: e.clientY }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  // While dragging, report the element's new position (live, so it follows the
  // cursor), snapped to the grid when snap-to-grid is enabled.
  const handlePointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d || !onMoveElement) return
    onMoveElement(
      d.id,
      draggedPosition(
        { x: d.startX, y: d.startY },
        { x: e.clientX - d.pointerX, y: e.clientY - d.pointerY },
        zoom,
        gridSize,
        snapToGrid,
      ),
    )
  }

  // End the drag.
  const handlePointerUp = (e: PointerEvent) => {
    if (!drag.current) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    drag.current = null
  }

  // The element being resized: its id, the handle grabbed, its start rect, and
  // the pointer's start point.
  const resize = useRef<{ id: string; handle: ResizeHandle; startRect: Rect; pointerX: number; pointerY: number } | null>(null)

  // Begin a resize when a corner handle is pressed (without starting a move).
  const handleResizeDown = (el: ReportElement, handle: ResizeHandle) => (e: PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    resize.current = { id: el.id, handle, startRect: el.rect, pointerX: e.clientX, pointerY: e.clientY }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  // While resizing, report the element's new rect (live), snapping the dragged
  // edges to the grid when snap-to-grid is enabled.
  const handleResizeMove = (e: PointerEvent) => {
    const r = resize.current
    if (!r || !onResize) return
    const delta = { x: pxToInches(e.clientX - r.pointerX, zoom), y: pxToInches(e.clientY - r.pointerY, zoom) }
    onResize(r.id, resizedRect(r.startRect, r.handle, delta, gridSize, snapToGrid))
  }

  // End the resize.
  const handleResizeUp = (e: PointerEvent) => {
    if (!resize.current) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    resize.current = null
  }

  // Allow a drop only when the host accepts inserts; copy is the drop effect.
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  // Place the dropped palette item where the cursor released, within the band.
  const handleDrop = (bandKind: BandKind) => (e: DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData(ELEMENT_DRAG_MIME)
    if (!isElementType(type)) return
    const rect = e.currentTarget.getBoundingClientRect()
    onInsertAt?.(type, bandKind, {
      x: pxToInches(e.clientX - rect.left, zoom),
      y: pxToInches(e.clientY - rect.top, zoom),
    })
  }

  // A grid overlay (drawn by .rb-page-grid in CSS) is shown when snapping is on;
  // its cell size tracks the grid spacing in pixels at the current zoom.
  const gridPx = inchesToPx(gridSize, zoom)
  const showGrid = snapToGrid && gridPx > 0

  return (
    // Clicking the page background (anywhere but an element) clears the selection.
    <div
      className={`rb-page${showGrid ? ' rb-page-grid' : ''}`}
      style={{
        width: px(template.page.width),
        ...(showGrid ? { backgroundSize: `${gridPx}px ${gridPx}px` } : {}),
      }}
      onClick={() => onSelectElement?.(null, false)}
    >
      {template.bands.map((band) => (
        <div
          key={band.kind}
          className={`rb-band rb-band-${band.kind}`}
          role="group"
          aria-label={BAND_LABELS[band.kind]}
          style={{ height: px(band.height) }}
          onDragOver={onInsertAt ? handleDragOver : undefined}
          onDrop={onInsertAt ? handleDrop(band.kind) : undefined}
        >
          <span className="rb-band-label overline" aria-hidden="true">
            {BAND_LABELS[band.kind]}
          </span>

          {band.elements.map((el) => {
            const content = elementContent(el)
            return (
              <Fragment key={el.id}>
                <button
                  type="button"
                  className={`rb-el rb-el-${el.type}${selectedIds.includes(el.id) ? ' rb-el-selected' : ''}`}
                  data-element-id={el.id}
                  aria-pressed={selectedIds.includes(el.id)}
                  aria-label={content === '' ? ELEMENT_TYPE_LABELS[el.type] : undefined}
                  style={{
                    left: px(el.rect.x),
                    top: px(el.rect.y),
                    width: px(el.rect.w),
                    height: px(el.rect.h),
                    ...elementTextCss(el.style, zoom),
                  }}
                  onClick={(e) => {
                    e.stopPropagation() // don't bubble to the page's deselect handler
                    // Mouse selection happens on pointer down; handle keyboard
                    // activation (Enter/Space) here, which fires click with no
                    // preceding pointer press (detail === 0).
                    if (e.detail === 0) onSelectElement?.(el.id, e.shiftKey || e.metaKey || e.ctrlKey)
                  }}
                  onPointerDown={handlePointerDown(el)}
                  onPointerMove={onMoveElement ? handlePointerMove : undefined}
                  onPointerUp={onMoveElement ? handlePointerUp : undefined}
                >
                  {content}
                </button>

                {/* Corner resize handles, shown only on a lone selected element. */}
                {onResize &&
                  el.id === soleSelectedId &&
                  RESIZE_HANDLES.map(({ handle, label }) => {
                    const cornerX = handle === 'ne' || handle === 'se' ? el.rect.x + el.rect.w : el.rect.x
                    const cornerY = handle === 'sw' || handle === 'se' ? el.rect.y + el.rect.h : el.rect.y
                    return (
                      <button
                        key={handle}
                        type="button"
                        className={`rb-handle rb-handle-${handle}`}
                        aria-label={`Resize ${label}`}
                        style={{ left: px(cornerX), top: px(cornerY) }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={handleResizeDown(el, handle)}
                        onPointerMove={handleResizeMove}
                        onPointerUp={handleResizeUp}
                      />
                    )
                  })}
              </Fragment>
            )
          })}
        </div>
      ))}
    </div>
  )
}
