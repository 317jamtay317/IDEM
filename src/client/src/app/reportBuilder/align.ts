/**
 * Pure alignment and distribution math for the Report Builder. Given the rects
 * of the currently selected elements, these helpers compute the new rects that
 * align them to a shared edge or space them with equal gaps. Kept free of React
 * and of the element/band model so the geometry can be tested in isolation; the
 * screen maps elements to rects, applies one of these, and writes the results
 * back by id.
 *
 * Geometry is band-relative (each rect's `x`/`y` is measured from its band's
 * top-left), matching the model. Because every band shares the page's left edge
 * as its x-origin, horizontal alignment and distribution are meaningful *across
 * bands* — the headline "align across groups" case (e.g. lining a column header
 * up with the data field below it). Vertical alignment compares band-relative
 * `y`, so it is exact within a single band; across bands it lines up each
 * element's offset within its own band rather than its absolute page position.
 */
import { type Rect } from './model'

/** Which edge (or centre line) a set of rects is aligned to. */
export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** The axis along which a set of rects is distributed. */
export type DistributeAxis = 'horizontal' | 'vertical'

/**
 * Aligns every rect to a shared edge of the selection's bounding box, returning
 * new rects (in the same order) with only the relevant coordinate changed. Left
 * uses the minimum X, right the maximum right edge, and center the horizontal
 * mid-line; top/bottom/middle are the vertical analogues. A single rect is
 * returned unchanged. The input rects are not mutated.
 *
 * @param rects The rects to align.
 * @param edge The edge (or centre line) to align them to.
 * @returns New rects aligned to `edge`, one per input rect in input order.
 */
export function alignRects(rects: Rect[], edge: AlignEdge): Rect[] {
  if (rects.length === 0) return []

  const minX = Math.min(...rects.map((r) => r.x))
  const maxRight = Math.max(...rects.map((r) => r.x + r.w))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxBottom = Math.max(...rects.map((r) => r.y + r.h))
  const centerX = (minX + maxRight) / 2
  const centerY = (minY + maxBottom) / 2

  return rects.map((r) => {
    switch (edge) {
      case 'left':
        return { ...r, x: minX }
      case 'right':
        return { ...r, x: maxRight - r.w }
      case 'center':
        return { ...r, x: centerX - r.w / 2 }
      case 'top':
        return { ...r, y: minY }
      case 'bottom':
        return { ...r, y: maxBottom - r.h }
      case 'middle':
        return { ...r, y: centerY - r.h / 2 }
    }
  })
}

/**
 * Distributes rects so the gaps between consecutive items along the axis are
 * equal, keeping the two extreme items fixed. Items are ordered by their leading
 * edge to compute positions, but the result preserves the input order. With
 * fewer than three rects there is nothing in between to space, so the input is
 * returned unchanged (copied). The input rects are not mutated.
 *
 * @param rects The rects to distribute.
 * @param axis `horizontal` to equalise left-to-right gaps, `vertical` for
 * top-to-bottom.
 * @returns New rects with equal gaps along `axis`, one per input rect in input
 * order.
 */
export function distributeRects(rects: Rect[], axis: DistributeAxis): Rect[] {
  const copy = rects.map((r) => ({ ...r }))
  if (rects.length < 3) return copy

  const horizontal = axis === 'horizontal'
  const lead = (r: Rect) => (horizontal ? r.x : r.y)
  const extent = (r: Rect) => (horizontal ? r.w : r.h)

  const order = rects.map((_, i) => i).sort((i, j) => lead(rects[i]) - lead(rects[j]))
  const start = lead(rects[order[0]])
  const lastIdx = order[order.length - 1]
  const end = lead(rects[lastIdx]) + extent(rects[lastIdx])
  const totalExtent = rects.reduce((sum, r) => sum + extent(r), 0)
  const gap = (end - start - totalExtent) / (rects.length - 1)

  let cursor = start
  for (const idx of order) {
    if (horizontal) copy[idx].x = cursor
    else copy[idx].y = cursor
    cursor += extent(rects[idx]) + gap
  }
  return copy
}
