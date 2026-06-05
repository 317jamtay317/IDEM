/**
 * Pure helpers for the Report Builder's footer page numbers (Phase 11): resolving
 * a page-number format to the concrete string shown on a given page, and the
 * placement options the editor offers. The options themselves live on the template
 * ({@link PageNumberOptions} in `model.ts`); these helpers are kept free of React
 * and the model mutators so the formatting can be tested in isolation.
 */
import { type PageNumberOptions, type TextAlign } from './model'

/** The footer placements the page-number editor offers, in display order. */
export const PAGE_NUMBER_POSITIONS: readonly { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

/**
 * Resolves a page-number format to the string shown on a given page: `{n}` becomes
 * the current page number and `{N}` the total, each offset so the first page counts
 * as {@link PageNumberOptions.startAt}. Every occurrence of a token is substituted;
 * literal text is left untouched.
 *
 * @param options The page-number options (only `format` and `startAt` are used).
 * @param currentPage The 1-based index of the page being rendered.
 * @param totalPages The number of pages in the document.
 * @returns The resolved page-number string.
 */
export function formatPageNumber(
  options: PageNumberOptions,
  currentPage: number,
  totalPages: number,
): string {
  const offset = options.startAt - 1
  const current = currentPage + offset
  const total = totalPages + offset
  return options.format.split('{n}').join(String(current)).split('{N}').join(String(total))
}
