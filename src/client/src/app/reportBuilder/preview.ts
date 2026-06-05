/**
 * Pure helpers backing the Report Builder's Preview (Phase 12): resolving an
 * element's bound expression to its displayed value, scoping the data to a single
 * detail row, and deciding which bands appear on a given page. Kept free of React
 * so the resolution/pagination logic can be tested in isolation; the layout lives
 * in `ReportPreview.tsx`.
 *
 * Pagination here is a *logical* preview: at design time there is no data to flow
 * content across pages, so the report header and detail render on the first page,
 * the sub-report on the last, and the page header/footer on every page — the real
 * data-driven paginator is the Report Engine's job (Phase 13).
 */
import { evaluateExpression, type DataContext } from './expressions'
import { type BandKind, type ReportElement } from './model'

/**
 * The text shown for an element in the preview: an expression-bound element is
 * evaluated against the data (falling back to its display text, then the raw
 * expression, if evaluation fails); a static element shows its text; a textless
 * shape shows nothing.
 *
 * @param el The element to render.
 * @param ctx The data the expression is evaluated against.
 * @returns The resolved display string.
 */
export function resolveElementText(el: ReportElement, ctx: DataContext): string {
  if (el.expression !== undefined) {
    const result = evaluateExpression(el.expression, ctx)
    return result.ok ? result.value : el.text ?? el.expression
  }
  return el.text ?? ''
}

/**
 * A data context scoped to a single detail row: the detail array holds just that
 * row, so a `{Record.Field}` reference resolves to the row's value, while the
 * singular scopes and page context are shared unchanged. Used to render the detail
 * band once per row.
 *
 * @param ctx The full data context.
 * @param rowIndex The detail row to scope to.
 * @returns A context whose detail is the single chosen row.
 */
export function rowContext(ctx: DataContext, rowIndex: number): DataContext {
  return { ...ctx, detail: [ctx.detail[rowIndex]] }
}

/**
 * Whether a band renders on a given preview page: the report header and detail on
 * the first page, the sub-report on the last page, and the page header and footer
 * on every page.
 *
 * @param band The band kind.
 * @param pageIndex The 0-based page index.
 * @param pageCount The number of pages.
 * @returns `true` if the band should render on that page.
 */
export function bandAppearsOnPage(band: BandKind, pageIndex: number, pageCount: number): boolean {
  switch (band) {
    case 'reportHeader':
    case 'detail':
      return pageIndex === 0
    case 'subReport':
      return pageIndex === pageCount - 1
    default: // pageHeader, pageFooter
      return true
  }
}
