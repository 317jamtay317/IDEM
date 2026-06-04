/**
 * The Report Builder's bottom status bar: the current zoom, the snap-to-grid
 * state, a summary of the selection (type, name and pixel position), and the
 * page indicator. The page count is fixed at one until multi-page support
 * (Phase 10).
 */
import { ELEMENT_TYPE_LABELS, toDisplayPx } from './elementDisplay'
import { type ReportElement } from './model'

/** Props for {@link StatusBar}. */
export interface StatusBarProps {
  /** The selected element, or `null` when nothing is selected. */
  selected: ReportElement | null
  /** The current canvas zoom, as a percentage. */
  zoom: number
  /** The number of pages in the document. Defaults to one. */
  pageCount?: number
  /** Whether snap-to-grid is enabled. Defaults to `false`. */
  snapToGrid?: boolean
  /** The grid spacing, in inches; shown (in pixels) only when snapping is on. */
  gridSize?: number
}

/** Renders the builder's status bar for the given selection, zoom and grid state. */
export function StatusBar({ selected, zoom, pageCount = 1, snapToGrid = false, gridSize = 0 }: StatusBarProps) {
  const selection = selected
    ? `Selected: ${ELEMENT_TYPE_LABELS[selected.type]} "${selected.text ?? selected.id}"` +
      ` · X ${toDisplayPx(selected.rect.x)} · Y ${toDisplayPx(selected.rect.y)}`
    : 'No selection'

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
