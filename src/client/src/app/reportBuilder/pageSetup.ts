/**
 * Pure page-setup helpers for the Report Builder (Phase 10): the named page-size
 * presets, deriving and changing a page's orientation, and counting the logical
 * pages a template produces. Orientation is not stored separately — it is implied
 * by whether the page is wider than it is tall (RDL's own convention), so it
 * round-trips through the page width/height without a dedicated field. Kept free
 * of React so the math can be tested in isolation.
 */
import { type PageSetup, type ReportTemplate } from './model'

/** A page's orientation, derived from its width and height. */
export type Orientation = 'portrait' | 'landscape'

/** The named page-size presets the Page Setup editor offers. */
export type PageSizeName = 'letter' | 'legal' | 'a4' | 'tabloid'

/** A named page size, with its dimensions given in portrait (width ≤ height), in inches. */
export interface PageSize {
  /** Stable preset key. */
  name: PageSizeName
  /** Human-readable label shown in the editor. */
  label: string
  /** Portrait width, in inches. */
  width: number
  /** Portrait height, in inches. */
  height: number
}

/** The selectable page sizes, in display order; dimensions are the portrait orientation. */
export const PAGE_SIZES: readonly PageSize[] = [
  { name: 'letter', label: 'Letter', width: 8.5, height: 11 },
  { name: 'legal', label: 'Legal', width: 8.5, height: 14 },
  { name: 'a4', label: 'A4', width: 8.27, height: 11.69 },
  { name: 'tabloid', label: 'Tabloid', width: 11, height: 17 },
]

/** How close two inch measurements must be to count as the same page size. */
const SIZE_TOLERANCE_IN = 0.02

/**
 * The orientation implied by a page's dimensions: landscape when it is wider than
 * it is tall, portrait otherwise (a square page reads as portrait).
 *
 * @param page The page (only its width and height are used).
 * @returns The page's {@link Orientation}.
 */
export function orientationOf(page: { width: number; height: number }): Orientation {
  return page.width > page.height ? 'landscape' : 'portrait'
}

/**
 * The named page-size preset matching the page's dimensions, ignoring
 * orientation, or `'custom'` when no preset matches (within a small tolerance, so
 * floating-point sizes like A4 still match).
 *
 * @param page The page (only its width and height are used).
 * @returns The matching {@link PageSizeName}, or `'custom'`.
 */
export function pageSizeNameOf(page: { width: number; height: number }): PageSizeName | 'custom' {
  const lo = Math.min(page.width, page.height)
  const hi = Math.max(page.width, page.height)
  for (const size of PAGE_SIZES) {
    if (Math.abs(lo - size.width) <= SIZE_TOLERANCE_IN && Math.abs(hi - size.height) <= SIZE_TOLERANCE_IN) {
      return size.name
    }
  }
  return 'custom'
}

/**
 * Sets the page to the named size while preserving its current orientation and
 * margins. Returns the page unchanged if the name is not a known preset.
 *
 * @param page The page to resize.
 * @param name The target page size.
 * @returns A new {@link PageSetup} at the named size.
 */
export function applyPageSize(page: PageSetup, name: PageSizeName): PageSetup {
  const size = PAGE_SIZES.find((s) => s.name === name)
  if (!size) return page
  const landscape = orientationOf(page) === 'landscape'
  return {
    ...page,
    width: landscape ? size.height : size.width,
    height: landscape ? size.width : size.height,
  }
}

/**
 * Orients the page by ordering its two dimensions: landscape puts the larger
 * dimension on the width, portrait puts it on the height. The page is otherwise
 * unchanged (so toggling orientation twice is a no-op), and the margins are kept.
 *
 * @param page The page to orient.
 * @param orientation The target orientation.
 * @returns A new {@link PageSetup} in the requested orientation.
 */
export function applyOrientation(page: PageSetup, orientation: Orientation): PageSetup {
  const lo = Math.min(page.width, page.height)
  const hi = Math.max(page.width, page.height)
  return orientation === 'landscape'
    ? { ...page, width: hi, height: lo }
    : { ...page, width: lo, height: hi }
}

/**
 * The number of logical pages the template produces in the designer: one, plus
 * one for every Page Break element placed in any band. At design time there is no
 * data to drive automatic page flow, so explicit page breaks are the pagination
 * mechanism (the produced Report paginates over real data at render time).
 *
 * @param template The template to count.
 * @returns The page count (always at least one).
 */
export function pageCount(template: ReportTemplate): number {
  let breaks = 0
  for (const band of template.bands) {
    for (const el of band.elements) {
      if (el.type === 'pageBreak') breaks++
    }
  }
  return breaks + 1
}
