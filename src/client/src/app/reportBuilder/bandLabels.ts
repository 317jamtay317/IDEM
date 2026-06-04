/** Human-readable names for the report bands, shown as the label tab on each. */
import { type BandKind } from './model'

/** Maps each {@link BandKind} to the display label shown on the canvas. */
export const BAND_LABELS: Record<BandKind, string> = {
  reportHeader: 'Report Header',
  pageHeader: 'Page Header',
  detail: 'Detail',
  subReport: 'Sub Report',
  pageFooter: 'Page Footer',
}
