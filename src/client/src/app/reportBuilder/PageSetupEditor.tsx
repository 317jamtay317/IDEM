/**
 * The Report Builder's document-level editor, shown in the Properties panel when
 * nothing is selected (Phase 10). It edits the page's size (a named preset),
 * orientation, and margins — the print geometry RDL stores on `<Page>` — and the
 * footer page-number options (Phase 11). Page size and orientation are derived
 * from the page's width and height via the pure helpers in {@link ./pageSetup};
 * margins are edited directly. Margins are shown in inches (the conventional unit
 * for page setup) rather than the pixels used for element geometry. Page edits are
 * reported via `onChange` as a partial {@link PageSetup}, and page-number edits via
 * `onPageNumbersChange` as a partial {@link PageNumberOptions}, the screen merges
 * into the model.
 */
import {
  PAGE_SIZES,
  applyOrientation,
  applyPageSize,
  orientationOf,
  pageSizeNameOf,
  type Orientation,
  type PageSizeName,
} from './pageSetup'
import { PAGE_NUMBER_POSITIONS } from './pageNumbers'
import { DEFAULT_PAGE_NUMBER_OPTIONS, type PageNumberOptions, type PageSetup, type TextAlign } from './model'

/** The margin sides, with the visible label shown for each. */
const MARGIN_SIDES: { side: keyof PageSetup['margins']; label: string }[] = [
  { side: 'top', label: 'Top' },
  { side: 'right', label: 'Right' },
  { side: 'bottom', label: 'Bottom' },
  { side: 'left', label: 'Left' },
]

/** A labelled numeric input for a margin, in inches. */
function MarginField(props: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rb-field">
      <label className="rb-field-label overline" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        id={props.id}
        className="rb-field-input"
        type="number"
        min={0}
        step={0.05}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  )
}

/** Props for {@link PageSetupEditor}. */
export interface PageSetupEditorProps {
  /** The page setup to edit. */
  page: PageSetup
  /** Reports an edit as a partial {@link PageSetup} to merge into the model. */
  onChange: (patch: Partial<PageSetup>) => void
  /** The footer page-number options to edit; defaults to the standard options. */
  pageNumbers?: PageNumberOptions
  /** Reports a page-number edit as a partial {@link PageNumberOptions} to merge in. */
  onPageNumbersChange?: (patch: Partial<PageNumberOptions>) => void
}

/**
 * Renders the document-level controls — page size, orientation, margins, and the
 * footer page-number options — for the template. With nothing selected on the
 * canvas this fills the Properties panel, so the document's print geometry and
 * page numbering are always one click away.
 */
export function PageSetupEditor({
  page,
  onChange,
  pageNumbers = DEFAULT_PAGE_NUMBER_OPTIONS,
  onPageNumbersChange,
}: PageSetupEditorProps) {
  const sizeName = pageSizeNameOf(page)
  const orientation = orientationOf(page)

  // Apply a named size (ignoring the synthetic "custom" entry, which only
  // reflects a page that matches no preset).
  const changeSize = (name: string) => {
    if (name !== 'custom') onChange(applyPageSize(page, name as PageSizeName))
  }

  const changeOrientation = (next: Orientation) => onChange(applyOrientation(page, next))

  const changeMargin = (side: keyof PageSetup['margins'], value: number) =>
    onChange({ margins: { ...page.margins, [side]: value } })

  return (
    <div className="rb-page-setup">
      <span className="section-title">Page Setup</span>

      <div className="rb-field">
        <label className="rb-field-label overline" htmlFor="rb-page-size">
          Size
        </label>
        <select
          id="rb-page-size"
          className="rb-field-input"
          aria-label="Page size"
          value={sizeName}
          onChange={(e) => changeSize(e.target.value)}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size.name} value={size.name}>
              {size.label}
            </option>
          ))}
          {sizeName === 'custom' && <option value="custom">Custom</option>}
        </select>
      </div>

      <div className="rb-field">
        <span className="rb-field-label overline">Orientation</span>
        <div className="rb-toggle-row">
          <button
            type="button"
            className={`rb-toggle${orientation === 'portrait' ? ' rb-toggle-active' : ''}`}
            aria-label="Portrait"
            aria-pressed={orientation === 'portrait'}
            onClick={() => changeOrientation('portrait')}
          >
            Portrait
          </button>
          <button
            type="button"
            className={`rb-toggle${orientation === 'landscape' ? ' rb-toggle-active' : ''}`}
            aria-label="Landscape"
            aria-pressed={orientation === 'landscape'}
            onClick={() => changeOrientation('landscape')}
          >
            Landscape
          </button>
        </div>
      </div>

      <div className="rb-field">
        <span className="rb-field-label overline">Margins (in)</span>
        <div className="rb-prop-grid">
          {MARGIN_SIDES.map(({ side, label }) => (
            <MarginField
              key={side}
              id={`rb-margin-${side}`}
              label={label}
              value={page.margins[side]}
              onChange={(v) => changeMargin(side, v)}
            />
          ))}
        </div>
      </div>

      <span className="section-title">Page Numbers</span>

      <div className="rb-field">
        <button
          type="button"
          className={`rb-toggle${pageNumbers.show ? ' rb-toggle-active' : ''}`}
          aria-label="Show page numbers"
          aria-pressed={pageNumbers.show}
          onClick={() => onPageNumbersChange?.({ show: !pageNumbers.show })}
        >
          {pageNumbers.show ? 'Shown' : 'Hidden'}
        </button>
      </div>

      <div className="rb-field">
        <label className="rb-field-label overline" htmlFor="rb-pagenum-format">
          Format
        </label>
        <input
          id="rb-pagenum-format"
          className="rb-field-input"
          type="text"
          value={pageNumbers.format}
          onChange={(e) => onPageNumbersChange?.({ format: e.target.value })}
        />
      </div>

      <div className="rb-prop-grid">
        <div className="rb-field">
          <label className="rb-field-label overline" htmlFor="rb-pagenum-start">
            Start at
          </label>
          <input
            id="rb-pagenum-start"
            className="rb-field-input"
            type="number"
            min={0}
            value={pageNumbers.startAt}
            onChange={(e) => onPageNumbersChange?.({ startAt: Number(e.target.value) })}
          />
        </div>
        <div className="rb-field">
          <label className="rb-field-label overline" htmlFor="rb-pagenum-position">
            Position
          </label>
          <select
            id="rb-pagenum-position"
            className="rb-field-input"
            aria-label="Page number position"
            value={pageNumbers.position}
            onChange={(e) => onPageNumbersChange?.({ position: e.target.value as TextAlign })}
          >
            {PAGE_NUMBER_POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
