/**
 * Drag-and-drop plumbing shared by the Insert palette (the drag source) and the
 * report canvas (the drop target): the MIME type that carries an element kind
 * across a drag, and a guard that validates the dropped payload before it is
 * trusted as an {@link ElementType}.
 */
import { ELEMENT_TYPE_LABELS } from './elementDisplay'
import { type ElementType } from './model'

/** The drag MIME used to carry an element type from the Insert palette to the canvas. */
export const ELEMENT_DRAG_MIME = 'application/x-rk-element'

/**
 * Narrows an arbitrary string (e.g. a dropped drag payload) to an
 * {@link ElementType}.
 *
 * @param value The candidate string.
 * @returns `true` if `value` is one of the builder's element types.
 */
export function isElementType(value: string): value is ElementType {
  return Object.prototype.hasOwnProperty.call(ELEMENT_TYPE_LABELS, value)
}
