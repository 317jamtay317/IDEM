/**
 * The mobile Insert sheet: a bottom sheet presenting the {@link InsertPalette}
 * with a search box, used on phones in place of the desktop sidebar. The host
 * mounts it when open and unmounts it on close, which also resets the search.
 */
import { useState } from 'react'
import { InsertPalette } from './InsertPalette'
import { type ElementType } from './model'

/** Props for {@link InsertSheet}. */
export interface InsertSheetProps {
  /** Dismisses the sheet without inserting (backdrop tap). */
  onClose: () => void
  /** Inserts an element of the chosen type; the host then closes the sheet. */
  onInsert: (type: ElementType) => void
}

/**
 * Renders the Insert sheet over the builder. Tapping the backdrop closes it;
 * typing in the search box filters the palette; choosing an item inserts it.
 */
export function InsertSheet({ onClose, onInsert }: InsertSheetProps) {
  const [query, setQuery] = useState('')

  return (
    <div className="rb-sheet-overlay" onClick={onClose}>
      <div
        className="rb-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Insert element"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rb-sheet-handle" aria-hidden="true" />
        <h2 className="rb-sheet-title">Insert element</h2>
        <input
          type="search"
          className="rb-field-input rb-sheet-search"
          placeholder="Search tools…"
          aria-label="Search tools"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <InsertPalette query={query} onInsert={onInsert} />
      </div>
    </div>
  )
}
