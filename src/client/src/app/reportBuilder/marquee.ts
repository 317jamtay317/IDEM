/**
 * Pure geometry for marquee (rubber-band) selection on the Report Builder canvas:
 * turning the two corner points of a drag into a normalized rectangle, testing
 * whether two rectangles overlap, and picking the elements a marquee covers. Kept
 * free of React (and of pixels — the caller converts to inches first) so the math
 * can be tested in isolation. All rects share one coordinate space; the canvas
 * passes page-absolute element rects so a marquee selects across bands.
 */
import { type Rect } from './model'

/** A point in the canvas plane. */
export interface Point {
  /** Distance from the left, in the caller's units. */
  x: number
  /** Distance from the top, in the caller's units. */
  y: number
}

/**
 * Builds the normalized rectangle spanning two corner points, so a drag in any
 * direction yields non-negative width and height.
 *
 * @param p1 One corner (the drag start).
 * @param p2 The opposite corner (the drag end).
 * @returns A {@link Rect} from the top-left of the two points to the bottom-right.
 */
export function marqueeRect(p1: Point, p2: Point): Rect {
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    w: Math.abs(p2.x - p1.x),
    h: Math.abs(p2.y - p1.y),
  }
}

/**
 * Whether two rectangles share interior area. Rectangles that merely touch at an
 * edge (no overlapping area) are not considered intersecting.
 *
 * @param a The first rectangle.
 * @param b The second rectangle.
 * @returns `true` when `a` and `b` overlap.
 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Selects the items whose rect the marquee intersects, preserving the input order
 * so the resulting selection keeps the elements' document order.
 *
 * @param marquee The marquee rectangle (same coordinate space as the items).
 * @param items The candidate elements, each with its id and rect.
 * @returns The ids of the intersected items, in input order.
 */
export function marqueeSelect(marquee: Rect, items: { id: string; rect: Rect }[]): string[] {
  return items.filter((item) => rectsIntersect(marquee, item.rect)).map((item) => item.id)
}
