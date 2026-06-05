/**
 * Maps an element's {@link ElementStyle} to the inline CSS the canvas applies to
 * its rendered text. Font size (points) is scaled to pixels at the current zoom;
 * alignment maps to both `text-align` and flex `justify-content` (canvas
 * elements are flex containers). Unset style properties produce no override, so
 * the canvas defaults apply.
 */
import { type CSSProperties } from 'react'
import { pointsToPx } from './geometry'
import { type ElementStyle, type FontWeight, type TextAlign } from './model'

/** CSS numeric weight for each designer font weight. */
const FONT_WEIGHT_CSS: Record<FontWeight, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
}

/** Flex `justify-content` for each alignment (the element is a flex container). */
const ALIGN_JUSTIFY: Record<TextAlign, CSSProperties['justifyContent']> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
}

/**
 * Builds the inline CSS for an element's text from its style and the zoom.
 *
 * @param style The element's style, or `undefined` for all defaults.
 * @param zoom The canvas zoom, as a percentage.
 * @returns The CSS properties to apply; empty when no style is set.
 */
export function elementTextCss(style: ElementStyle | undefined, zoom: number): CSSProperties {
  const css: CSSProperties = {}
  if (!style) return css

  if (style.fontFamily) css.fontFamily = style.fontFamily
  if (style.fontSize !== undefined) css.fontSize = `${pointsToPx(style.fontSize, zoom)}px`
  if (style.fontWeight) css.fontWeight = FONT_WEIGHT_CSS[style.fontWeight]
  if (style.italic) css.fontStyle = 'italic'
  if (style.underline) css.textDecoration = 'underline'
  if (style.align) {
    css.textAlign = style.align
    css.justifyContent = ALIGN_JUSTIFY[style.align]
  }
  if (style.color) css.color = style.color

  return css
}
