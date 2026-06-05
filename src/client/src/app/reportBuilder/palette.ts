/**
 * The Insert palette's contents: the element types the Report Builder offers,
 * arranged into the groups shown in the palette (Text, Shapes, Media, Advanced)
 * and in the order they appear. Display labels come from
 * {@link ELEMENT_TYPE_LABELS}; this module only fixes grouping and order, so it
 * stays pure data shared by the desktop sidebar and the mobile Insert sheet.
 */
import { type ElementType } from './model'

/** A named, ordered group of element types in the Insert palette. */
export interface PaletteGroup {
  /** The group's heading (e.g. `Text`), shown uppercased in the palette. */
  name: string
  /** The element types offered under this group, in display order. */
  types: ElementType[]
}

/** The Insert palette, grouped and ordered as shown to the user. */
export const PALETTE_GROUPS: readonly PaletteGroup[] = [
  { name: 'Text', types: ['label', 'formula', 'dataField'] },
  { name: 'Shapes', types: ['line', 'rectangle', 'triangle', 'ellipse'] },
  { name: 'Media', types: ['image', 'barcode'] },
  { name: 'Advanced', types: ['subReport', 'table', 'chart', 'pageBreak'] },
]
