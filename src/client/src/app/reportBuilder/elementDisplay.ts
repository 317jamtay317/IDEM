/**
 * Presentation helpers shared by the Report Builder's Properties panel and
 * status bar: human-readable element-type names and the inches→pixels display
 * convention. The model stores geometry in inches; the editing UI presents it in
 * whole pixels (at the reference resolution), matching the design.
 */
import { PX_PER_INCH } from './geometry'
import { type ElementType } from './model'

/** Maps each {@link ElementType} to the label shown for it in the editing UI. */
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  label: 'Label',
  dataField: 'Data Field',
  formula: 'Formula',
  line: 'Line',
  rectangle: 'Rectangle',
  triangle: 'Triangle',
  ellipse: 'Ellipse',
  image: 'Image',
  barcode: 'Barcode',
  subReport: 'Sub Report',
  table: 'Table',
  chart: 'Chart',
  pageBreak: 'Page Break',
}

/**
 * Converts an inches measurement to the whole-pixel value shown in the editing
 * UI (X/Y/W/H fields, status bar).
 *
 * @param inches The measurement, in inches.
 * @returns The measurement in pixels at the reference resolution, rounded.
 */
export function toDisplayPx(inches: number): number {
  return Math.round(inches * PX_PER_INCH)
}

/**
 * Converts a whole-pixel value entered in the editing UI back to inches for the
 * model — the inverse of {@link toDisplayPx}.
 *
 * @param px The pixel value.
 * @returns The measurement in inches.
 */
export function fromDisplayPx(px: number): number {
  return px / PX_PER_INCH
}
