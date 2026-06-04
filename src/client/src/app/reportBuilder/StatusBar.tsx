/**
 * The Report Builder's bottom status bar: the current zoom, the snap-to-grid
 * state, a summary of the selection (type, name and pixel position for a single
 * element, or a count when several are selected), and the page indicator. The
 * page count is fixed at one until multi-page support (Phase 10).
 */
import { ELEMENT_TYPE_LABELS, toDisplayPx } from './elementDisplay'
import { type ReportElement } from './model'

/** Props for {@link StatusBar}. */
export interface StatusBarProps {
  /** The sole selected element, or `null` when nothing (or more than one) is selected. */
  selected: ReportElement | null
  /** The current canvas zoom, as a percentage. */
  zoom: number
  /**
   * How many elements are selected. Defaults to one when `selected` is set and
   * zero otherwise; pass it explicitly to summarise a multi-selection.
   */
  selectedCount?: number
  /** The number of pages in the document. Defaults to one. */
  pageCount?: number
  /** Whether snap-to-grid is enabled. Defaults to `false`. */
  snapToGrid?: boolean
  /** The grid spacing, in inches; shown (in pixels) only when snapping is on. */
  gridSize?: number
}

/** Renders the builder's status bar for the given selection, zoom and grid state. */
export function StatusBar({
  selected,
  zoom,
  selectedCount,
  pageCount = 1,
  snapToGrid = false,
  gridSize = 0,
}: StatusBarProps) {
  const count = selectedCount ?? (selected ? 1 : 0)

  let selection: string
  if (count > 1) {
    selection = `Selected: ${count} elements`
  } else if (selected) {
    selection =
      `Selected: ${ELEMENT_TYPE_LABELS[selected.type]} "${selected.text ?? selected.id}"` +
      ` · X ${toDisplayPx(selected.rect.x)} · Y ${toDisplayPx(selected.rect.y)}`
  } else {
    selection = 'No selection'
  }

  const snapStatus = snapToGrid ? `Snap: On · Grid ${toDisplayPx(gridSize)}px` : 'Snap: Off'

  return (
    <footer className="rb-statusbar" aria-label="Builder status">
      <span className="rb-status-zoom">Zoom {zoom}%</span>
      <span className="rb-status-snap">{snapStatus}</span>
      <span className="rb-status-selection">{selection}</span>
      <span className="rb-status-page">Page 1 of {pageCount}</span>
    </footer>
  )
}
