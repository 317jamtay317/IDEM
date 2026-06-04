/**
 * The Report Builder's bottom status bar: the current zoom, a summary of the
 * selection (type, name and pixel position), and the page indicator. Snap and
 * alignment readouts join it in later phases; the page count is fixed at one
 * until multi-page support (Phase 10).
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
}

/** Renders the builder's status bar for the given selection and zoom. */
export function StatusBar({ selected, zoom, pageCount = 1 }: StatusBarProps) {
  const selection = selected
    ? `Selected: ${ELEMENT_TYPE_LABELS[selected.type]} "${selected.text ?? selected.id}"` +
      ` · X ${toDisplayPx(selected.rect.x)} · Y ${toDisplayPx(selected.rect.y)}`
    : 'No selection'

  return (
    <footer className="rb-statusbar" aria-label="Builder status">
      <span className="rb-status-zoom">Zoom {zoom}%</span>
      <span className="rb-status-selection">{selection}</span>
      <span className="rb-status-page">Page 1 of {pageCount}</span>
    </footer>
  )
}
