/**
 * Pure geometry helpers for the Report Builder canvas: converting the model's
 * native inches to on-screen pixels, stepping through the discrete zoom levels,
 * and the drag/resize math. Kept free of React so the math can be tested in
 * isolation.
 */
import { type Rect } from './model'

/** A corner resize handle on a selected element. */
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

/** CSS reference resolution: 96 pixels per inch at 100% zoom. */
export const PX_PER_INCH = 96

/** Typographic points per inch — RDL's font-size unit. */
export const POINTS_PER_INCH = 72

/** The selectable canvas zoom levels, as percentages, in ascending order. */
export const ZOOM_LEVELS: readonly number[] = [50, 75, 100, 125, 150, 200]

/** The zoom level (percent) a freshly opened canvas starts at. */
export const DEFAULT_ZOOM = 100

/**
 * Converts an inches measurement to on-screen CSS pixels at the given zoom.
 *
 * @param inches The measurement, in inches (the model's native unit).
 * @param zoomPercent The canvas zoom, as a percentage (100 = actual size).
 * @returns The corresponding length in CSS pixels.
 */
export function inchesToPx(inches: number, zoomPercent: number): number {
  return inches * PX_PER_INCH * (zoomPercent / 100)
}

/**
 * Converts a point font size to on-screen CSS pixels at the given zoom.
 *
 * @param points The font size, in typographic points.
 * @param zoomPercent The canvas zoom, as a percentage (100 = actual size).
 * @returns The corresponding size in CSS pixels.
 */
export function pointsToPx(points: number, zoomPercent: number): number {
  return points * (PX_PER_INCH / POINTS_PER_INCH) * (zoomPercent / 100)
}

/**
 * Converts an on-screen CSS pixel length back to inches at the given zoom — the
 * inverse of {@link inchesToPx}. Used to translate a drop point on the canvas
 * into a model position.
 *
 * @param px The length in CSS pixels.
 * @param zoomPercent The canvas zoom, as a percentage (100 = actual size).
 * @returns The corresponding measurement in inches.
 */
export function pxToInches(px: number, zoomPercent: number): number {
  return px / (PX_PER_INCH * (zoomPercent / 100))
}

/**
 * Snaps a measurement to the nearest grid line. When snapping is disabled (or the
 * grid is non-positive) the value is returned unchanged, so callers can route
 * every coordinate through `snap` regardless of the current setting.
 *
 * @param value The measurement, in inches.
 * @param grid The grid spacing, in inches.
 * @param enabled Whether snapping is active.
 * @returns The value rounded to the nearest multiple of `grid`, or the original
 * value when snapping is off or `grid` is zero or negative.
 */
export function snap(value: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return value
  return Math.round(value / grid) * grid
}

/**
 * The new top-left position (inches) of an element being dragged: its start
 * position offset by the pointer's pixel delta (converted to inches at the given
 * zoom), clamped so it never moves past the band/page origin and, when snapping
 * is enabled, aligned to the grid.
 *
 * @param start The element's position at drag start, in inches.
 * @param deltaPx The pointer movement since drag start, in CSS pixels.
 * @param zoomPercent The canvas zoom, as a percentage (100 = actual size).
 * @param grid The grid spacing, in inches (defaults to no grid).
 * @param snapEnabled Whether to snap the result to the grid (defaults to `false`).
 * @returns The clamped (and optionally snapped) new position, in inches.
 */
export function draggedPosition(
  start: { x: number; y: number },
  deltaPx: { x: number; y: number },
  zoomPercent: number,
  grid = 0,
  snapEnabled = false,
): { x: number; y: number } {
  return {
    x: snap(Math.max(0, start.x + pxToInches(deltaPx.x, zoomPercent)), grid, snapEnabled),
    y: snap(Math.max(0, start.y + pxToInches(deltaPx.y, zoomPercent)), grid, snapEnabled),
  }
}

/**
 * The new rect for an element being resized by dragging one of its corner
 * handles by `deltaInches`. Only the two edges the handle owns move; the
 * opposite corner stays put. When snapping is enabled the dragged edges are
 * aligned to the grid. Edges are clamped so the rect never inverts (size
 * collapses to zero instead) and a moved edge never crosses the page origin.
 *
 * @param start The element's rect at resize start, in inches.
 * @param handle The corner being dragged.
 * @param deltaInches The pointer movement since resize start, in inches.
 * @param grid The grid spacing, in inches (defaults to no grid).
 * @param snapEnabled Whether to snap the dragged edges to the grid (defaults to `false`).
 * @returns The new {@link Rect}, in inches.
 */
export function resizedRect(
  start: Rect,
  handle: ResizeHandle,
  deltaInches: { x: number; y: number },
  grid = 0,
  snapEnabled = false,
): Rect {
  const startLeft = start.x
  const startTop = start.y
  const startRight = start.x + start.w
  const startBottom = start.y + start.h

  let left = startLeft
  let top = startTop
  let right = startRight
  let bottom = startBottom

  // Snap each dragged edge to its target grid line before clamping, so the moved
  // edge lands on the grid regardless of where it started.
  const s = (edge: number) => snap(edge, grid, snapEnabled)

  if (handle === 'se' || handle === 'ne') right = Math.max(startLeft, s(startRight + deltaInches.x))
  if (handle === 'sw' || handle === 'nw') left = Math.min(startRight, Math.max(0, s(startLeft + deltaInches.x)))
  if (handle === 'se' || handle === 'sw') bottom = Math.max(startTop, s(startBottom + deltaInches.y))
  if (handle === 'ne' || handle === 'nw') top = Math.min(startBottom, Math.max(0, s(startTop + deltaInches.y)))

  return { x: left, y: top, w: right - left, h: bottom - top }
}

/**
 * The cumulative top offset (in inches) of each band in a stacked banded page:
 * the first band starts at zero and each subsequent band starts below the sum of
 * the heights above it. Used to lift band-relative element positions into
 * page-absolute coordinates for cross-band hit-testing (marquee, smart guides).
 *
 * @param bands The bands, top to bottom, each carrying its height in inches.
 * @returns The top offset of each band, in inches, parallel to `bands`.
 */
export function bandTops(bands: readonly { height: number }[]): number[] {
  const tops: number[] = []
  let cursor = 0
  for (const band of bands) {
    tops.push(cursor)
    cursor += band.height
  }
  return tops
}

/**
 * The next zoom level above the given one.
 *
 * @param zoomPercent The current zoom (percent).
 * @returns The next higher {@link ZOOM_LEVELS} entry, or the current zoom if it
 * is already at or above the maximum.
 */
export function zoomIn(zoomPercent: number): number {
  return ZOOM_LEVELS.find((level) => level > zoomPercent) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
}

/**
 * The next zoom level below the given one.
 *
 * @param zoomPercent The current zoom (percent).
 * @returns The next lower {@link ZOOM_LEVELS} entry, or the current zoom if it
 * is already at or below the minimum.
 */
export function zoomOut(zoomPercent: number): number {
  return [...ZOOM_LEVELS].reverse().find((level) => level < zoomPercent) ?? ZOOM_LEVELS[0]
}
