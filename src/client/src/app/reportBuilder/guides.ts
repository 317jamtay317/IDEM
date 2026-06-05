/**
 * Pure math for the Report Builder's smart alignment guides. While an element is
 * dragged, we compare each of its alignment lines — left / centre / right
 * (vertical) and top / middle / bottom (horizontal) — against those of the other
 * elements and surface the lines that match within a tolerance. The result drives
 * the thin guide lines the canvas overlays during the drag.
 *
 * Kept free of React and pixels (the caller converts a pixel tolerance to inches
 * for the current zoom) so the geometry can be tested in isolation. All rects
 * share one coordinate space; the canvas passes page-absolute rects so guides line
 * elements up across bands.
 */
import { type Rect } from './model'

/** A single alignment guide line to draw on the canvas. */
export interface AlignmentGuide {
  /** Whether the guide is a vertical line (constant x) or horizontal (constant y). */
  orientation: 'vertical' | 'horizontal'
  /** The line's position, in inches: the x for a vertical guide, the y for a horizontal one. */
  position: number
}

/** The default match tolerance, in CSS pixels, before conversion to inches. */
export const GUIDE_TOLERANCE_PX = 6

/** The three vertical alignment lines of a rect: left edge, centre, right edge. */
function verticalLines(r: Rect): number[] {
  return [r.x, r.x + r.w / 2, r.x + r.w]
}

/** The three horizontal alignment lines of a rect: top edge, middle, bottom edge. */
function horizontalLines(r: Rect): number[] {
  return [r.y, r.y + r.h / 2, r.y + r.h]
}

/**
 * Computes the alignment guides to show while `moving` is dragged among `others`.
 * For every pair of a moving line and another element's matching-orientation line
 * that fall within `tolerance`, a guide is emitted at the other element's line —
 * the static reference the moving element is snapping toward. Duplicate guides
 * (the same orientation and position shared by several elements) are collapsed.
 *
 * @param moving The rect being dragged.
 * @param others The other elements' rects, in the same coordinate space.
 * @param tolerance The maximum distance, in the rects' units, for lines to match.
 * @returns The distinct guide lines to draw, in discovery order.
 */
export function alignmentGuides(moving: Rect, others: Rect[], tolerance: number): AlignmentGuide[] {
  const seen = new Set<string>()
  const guides: AlignmentGuide[] = []

  const add = (orientation: AlignmentGuide['orientation'], position: number) => {
    const key = `${orientation}:${position}`
    if (seen.has(key)) return
    seen.add(key)
    guides.push({ orientation, position })
  }

  const movingV = verticalLines(moving)
  const movingH = horizontalLines(moving)

  for (const other of others) {
    for (const ov of verticalLines(other)) {
      if (movingV.some((mv) => Math.abs(mv - ov) <= tolerance)) add('vertical', ov)
    }
    for (const oh of horizontalLines(other)) {
      if (movingH.some((mh) => Math.abs(mh - oh) <= tolerance)) add('horizontal', oh)
    }
  }

  return guides
}
