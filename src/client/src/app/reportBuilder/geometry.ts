/**
 * Pure geometry helpers for the Report Builder canvas: converting the model's
 * native inches to on-screen pixels, and stepping through the discrete zoom
 * levels. Kept free of React so the math can be tested in isolation.
 */

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
 * The new top-left position (inches) of an element being dragged: its start
 * position offset by the pointer's pixel delta (converted to inches at the given
 * zoom), clamped so it never moves past the band/page origin.
 *
 * @param start The element's position at drag start, in inches.
 * @param deltaPx The pointer movement since drag start, in CSS pixels.
 * @param zoomPercent The canvas zoom, as a percentage (100 = actual size).
 * @returns The clamped new position, in inches.
 */
export function draggedPosition(
  start: { x: number; y: number },
  deltaPx: { x: number; y: number },
  zoomPercent: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, start.x + pxToInches(deltaPx.x, zoomPercent)),
    y: Math.max(0, start.y + pxToInches(deltaPx.y, zoomPercent)),
  }
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
