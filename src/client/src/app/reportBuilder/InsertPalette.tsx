/**
 * The Insert palette: the grouped, ordered set of element types the Report
 * Builder can place, shared by the desktop sidebar and the mobile Insert sheet.
 * Clicking an item asks the host to insert an element of that type; items are
 * also draggable, carrying their type so they can be dropped onto the canvas.
 *
 * Two presentations: the default shows an icon + label per item under group
 * headings (the sheet uses this, with its search `query` filtering by label);
 * `compact` renders a slim icon-only rail with the label as a tooltip and no
 * group headings (the desktop sidebar uses this to stay narrow).
 */
import { type DragEvent } from 'react'
import { ELEMENT_DRAG_MIME } from './dnd'
import { ELEMENT_TYPE_LABELS } from './elementDisplay'
import { type ElementType } from './model'
import { PALETTE_GROUPS } from './palette'

/** Decorative glyph shown beside each palette item; never its accessible name. */
const ICONS: Record<ElementType, string> = {
  label: 'T',
  formula: 'fx',
  dataField: '{ }',
  line: '╱',
  rectangle: '▭',
  triangle: '△',
  ellipse: '◯',
  image: '⊡',
  barcode: '|||',
  subReport: '❏',
  table: '▦',
  chart: '▥',
  pageBreak: '┄',
}

/** Props for {@link InsertPalette}. */
export interface InsertPaletteProps {
  /** Inserts an element of the chosen type into the report. */
  onInsert: (type: ElementType) => void
  /** Optional case-insensitive label filter; empty (the default) shows everything. */
  query?: string
  /** Render a slim icon-only rail (labels as tooltips, no group headers); for the sidebar. */
  compact?: boolean
}

/**
 * Renders the palette groups and their element-type buttons. With a `query`,
 * only items whose label contains it are shown and empty groups are dropped;
 * when nothing matches, an empty-state message is shown instead. Each item can
 * be clicked to insert into the active band, or dragged onto the canvas.
 */
export function InsertPalette({ onInsert, query = '', compact = false }: InsertPaletteProps) {
  const needle = query.trim().toLowerCase()
  const groups = PALETTE_GROUPS.map((group) => ({
    name: group.name,
    types: group.types.filter((type) => ELEMENT_TYPE_LABELS[type].toLowerCase().includes(needle)),
  })).filter((group) => group.types.length > 0)

  if (groups.length === 0) {
    return <p className="rb-empty">No matching tools.</p>
  }

  // Carry the element type (and a human-readable fallback) on the drag.
  const handleDragStart = (type: ElementType) => (e: DragEvent) => {
    e.dataTransfer.setData(ELEMENT_DRAG_MIME, type)
    e.dataTransfer.setData('text/plain', ELEMENT_TYPE_LABELS[type])
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className={`rb-palette-list${compact ? ' rb-palette-list--compact' : ''}`}>
      {groups.map((group) => (
        <div key={group.name} className="rb-palette-group">
          {!compact && <span className="overline rb-palette-group-name">{group.name}</span>}
          <div className="rb-palette-items">
            {group.types.map((type) => {
              const label = ELEMENT_TYPE_LABELS[type]
              return (
                <button
                  key={type}
                  type="button"
                  className="rb-palette-item"
                  draggable
                  onDragStart={handleDragStart(type)}
                  onClick={() => onInsert(type)}
                  title={compact ? label : undefined}
                  aria-label={compact ? label : undefined}
                >
                  <span className="rb-palette-icon" aria-hidden="true">
                    {ICONS[type]}
                  </span>
                  {!compact && <span className="rb-palette-item-label">{label}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
