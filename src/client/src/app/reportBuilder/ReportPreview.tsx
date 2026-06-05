/**
 * The Report Builder's Preview (Phase 12): a read-only, paginated render of the
 * template with its data bindings resolved. Unlike the editing canvas — which
 * shows binding tokens verbatim — the preview evaluates each expression against
 * sample Report data (Phase 9), expands the detail band to one row per detail
 * record, and lays the report out across the pages the template's page breaks
 * define (Phase 10), numbering each page from the page-number options (Phase 11).
 *
 * It is a *logical* preview: at design time there is no data to flow content
 * across pages, so {@link bandAppearsOnPage} places the report header and detail
 * on the first page and the sub-report on the last, with the page header/footer on
 * every page. A faithful data-driven paginator is the Report Engine's job (Phase 13).
 */
import { type DataContext } from './expressions'
import { elementTextCss } from './elementStyleCss'
import { inchesToPx } from './geometry'
import { formatPageNumber } from './pageNumbers'
import { pageCount } from './pageSetup'
import { bandAppearsOnPage, resolveElementText, rowContext } from './preview'
import { SAMPLE_DATA_CONTEXT } from './sampleData'
import { type Band, type ReportElement, type ReportTemplate } from './model'

/** The preview renders at actual size; the modal body scrolls for larger pages. */
const PREVIEW_ZOOM = 100

/** Props for {@link ReportPreview}. */
export interface ReportPreviewProps {
  /** The template to render. */
  template: ReportTemplate
  /** Closes the preview. */
  onClose: () => void
  /** The data bindings resolve against; defaults to the sample Report data. */
  context?: DataContext
}

/**
 * Renders {@link ReportPreview}: a modal dialog showing the template's pages with
 * bindings resolved against `context`. Clicking the backdrop or the Close button
 * dismisses it.
 */
export function ReportPreview({ template, onClose, context = SAMPLE_DATA_CONTEXT }: ReportPreviewProps) {
  const pages = pageCount(template)
  const px = (inches: number) => `${inchesToPx(inches, PREVIEW_ZOOM)}px`

  // One resolved, absolutely-positioned element (page breaks carry no content).
  const renderElement = (el: ReportElement, ctx: DataContext, key: string) => {
    if (el.type === 'pageBreak') return null
    return (
      <div
        key={key}
        className={`rb-el rb-el-${el.type}`}
        style={{
          left: px(el.rect.x),
          top: px(el.rect.y),
          width: px(el.rect.w),
          height: px(el.rect.h),
          ...elementTextCss(el.style, PREVIEW_ZOOM),
        }}
      >
        {resolveElementText(el, ctx)}
      </div>
    )
  }

  // A band as one block (its elements) — except the detail band, which repeats
  // once per detail row with that row's data, and the footer, which carries the
  // resolved page number.
  const renderBand = (band: Band, pageNumber: number) => {
    if (band.kind === 'detail') {
      return context.detail.map((_, rowIndex) => (
        <div key={`detail-${rowIndex}`} className="rb-preview-band" style={{ height: px(band.height) }}>
          {band.elements.map((el) => renderElement(el, rowContext(context, rowIndex), `${el.id}-${rowIndex}`))}
        </div>
      ))
    }
    return (
      <div key={band.kind} className="rb-preview-band" style={{ height: px(band.height) }}>
        {band.elements.map((el) => renderElement(el, context, el.id))}
        {band.kind === 'pageFooter' && template.pageNumbers.show && (
          <div className="rb-page-number" style={{ textAlign: template.pageNumbers.position }}>
            {formatPageNumber(template.pageNumbers, pageNumber, pages)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rb-preview-overlay" onClick={onClose}>
      <div
        className="rb-preview"
        role="dialog"
        aria-modal="true"
        aria-label="Report preview"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rb-preview-header">
          <span className="rb-preview-title">{template.name} — Preview</span>
          <button type="button" className="button button-secondary button-sm" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="rb-preview-body">
          {Array.from({ length: pages }, (_, i) => i + 1).map((pageNumber) => (
            <div key={pageNumber} className="rb-preview-page" style={{ width: px(template.page.width) }}>
              {template.bands
                .filter((band) => bandAppearsOnPage(band.kind, pageNumber - 1, pages))
                .map((band) => renderBand(band, pageNumber))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
