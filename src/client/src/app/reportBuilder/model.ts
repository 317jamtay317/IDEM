/**
 * The in-memory model for a Report Template — the artifact the Report Builder
 * authors. The model is intentionally designer-friendly (bands, elements,
 * inches); the mapping to RDL/RDLC happens only at the serialization boundary
 * (see `rdl.ts`).
 *
 * All geometry is expressed in **inches**, RDL's native unit. The on-screen
 * canvas converts inches to pixels at render time (a later phase).
 */

/** Position and size of an element within its band, in inches. */
export interface Rect {
  /** Distance from the band's left edge, in inches. */
  x: number
  /** Distance from the band's top edge, in inches. */
  y: number
  /** Width, in inches. */
  w: number
  /** Height, in inches. */
  h: number
}

/**
 * The kinds of element the Report Builder can place, mirroring the Insert
 * palette: text (`label`, `dataField`, `formula`), shapes (`line`, `rectangle`,
 * `triangle`, `ellipse`), media (`image`, `barcode`), and advanced container
 * types (`subReport`, `table`, `chart`, `pageBreak`). The advanced types render
 * as placeholder blocks on the canvas until their own phases flesh them out.
 */
export type ElementType =
  | 'label'
  | 'dataField'
  | 'formula'
  | 'line'
  | 'rectangle'
  | 'triangle'
  | 'ellipse'
  | 'image'
  | 'barcode'
  | 'subReport'
  | 'table'
  | 'chart'
  | 'pageBreak'

/** The font weights offered for an element's text. */
export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold'

/** Horizontal text alignment options for an element. */
export type TextAlign = 'left' | 'center' | 'right'

/**
 * Visual styling for an element. Every field is optional; an unset field falls
 * back to the canvas default at render time (and is omitted from RDL). Font size
 * is in points (RDL's font unit); `color` is the element's fill, a CSS hex
 * colour. Boolean toggles are stored only when on (`true`/absent, never `false`)
 * so they round-trip through RDL cleanly.
 */
export interface ElementStyle {
  /** Font family, e.g. `Inter`. */
  fontFamily?: string
  /** Font size, in points. */
  fontSize?: number
  /** Font weight. */
  fontWeight?: FontWeight
  /** Whether the text is italic. */
  italic?: boolean
  /** Whether the text is underlined. */
  underline?: boolean
  /** Horizontal text alignment. */
  align?: TextAlign
  /** Fill (text) colour as a CSS hex string, e.g. `#0F172A`. */
  color?: string
}

/** A single element placed in a band. */
export interface ReportElement {
  /** Stable identifier, unique within the template. */
  id: string
  /** What kind of element this is. */
  type: ElementType
  /** Where the element sits within its band, in inches. */
  rect: Rect
  /** Static text (a label) or the display token for a binding/formula, e.g. `{Record.Tons}`. */
  text?: string
  /** Designer expression for a dataField/formula, e.g. `{Record.Tons}` or `SUM({Record.Tons})`. */
  expression?: string
  /** Visual styling; absent means all canvas defaults. */
  style?: ElementStyle
}

/** The bands of a banded report, from top to bottom. */
export type BandKind = 'reportHeader' | 'pageHeader' | 'detail' | 'subReport' | 'pageFooter'

/** The canonical top-to-bottom order of the report bands. */
export const BAND_ORDER: readonly BandKind[] = [
  'reportHeader',
  'pageHeader',
  'detail',
  'subReport',
  'pageFooter',
]

/** A horizontal band of the report holding positioned elements. */
export interface Band {
  /** Which band this is. */
  kind: BandKind
  /** The band's height, in inches. */
  height: number
  /** The elements placed in this band, in document order. */
  elements: ReportElement[]
}

/** Page geometry, in inches. */
export interface PageSetup {
  /** Page width, in inches (US Letter = 8.5). */
  width: number
  /** Page height, in inches (US Letter = 11). */
  height: number
  /** Page margins, in inches. */
  margins: { top: number; right: number; bottom: number; left: number }
}

/** Designer settings persisted alongside the template. */
export interface BuilderSettings {
  /** Whether move/resize snaps to the grid (Phase 7). */
  snapToGrid: boolean
  /** Grid spacing, in inches (Phase 7). */
  gridSize: number
}

/**
 * A Report Template: the definition of a Report's layout and data bindings,
 * authored in the Report Builder and serialized to RDL/RDLC for storage.
 */
export interface ReportTemplate {
  /** Stable identifier. */
  id: string
  /** Display name. */
  name: string
  /** Definition schema version, supporting reproducibility (I-D08). */
  version: number
  /** Page geometry. */
  page: PageSetup
  /** The report bands, in {@link BAND_ORDER}. */
  bands: Band[]
  /** Designer settings. */
  settings: BuilderSettings
}

/** The current Report Template definition schema version. */
export const TEMPLATE_VERSION = 1

/** Default heights (inches) for a freshly created band. */
const DEFAULT_BAND_HEIGHTS: Record<BandKind, number> = {
  reportHeader: 1.5,
  pageHeader: 0.35,
  detail: 0.3,
  subReport: 1,
  pageFooter: 0.35,
}

/**
 * Creates an empty Report Template: US Letter, one-inch margins, the five report
 * bands in {@link BAND_ORDER} with no elements, and snap-to-grid enabled.
 *
 * @param id Stable identifier for the new template.
 * @param name Display name for the new template.
 * @returns A fresh {@link ReportTemplate} at the current {@link TEMPLATE_VERSION}.
 */
export function createEmptyTemplate(id: string, name: string): ReportTemplate {
  return {
    id,
    name,
    version: TEMPLATE_VERSION,
    page: {
      width: 8.5,
      height: 11,
      margins: { top: 1, right: 1, bottom: 1, left: 1 },
    },
    bands: BAND_ORDER.map((kind) => ({
      kind,
      height: DEFAULT_BAND_HEIGHTS[kind],
      elements: [],
    })),
    settings: { snapToGrid: true, gridSize: 0.125 },
  }
}

/**
 * Locates an element by id anywhere in the template, across all bands.
 *
 * @param template The template to search.
 * @param id The element id to find, or `null` for "no selection".
 * @returns The matching {@link ReportElement}, or `null` if `id` is `null` or no
 * element has that id.
 */
export function findElement(template: ReportTemplate, id: string | null): ReportElement | null {
  if (id === null) return null
  for (const band of template.bands) {
    const found = band.elements.find((el) => el.id === id)
    if (found) return found
  }
  return null
}

/**
 * Returns a new template with the element of the given id replaced by the result
 * of `update`. The original template is not mutated; if no element matches, an
 * equivalent template is returned.
 *
 * @param template The template to update.
 * @param id The id of the element to replace.
 * @param update Maps the existing element to its replacement.
 * @returns A new {@link ReportTemplate} with the change applied.
 */
export function updateElement(
  template: ReportTemplate,
  id: string,
  update: (el: ReportElement) => ReportElement,
): ReportTemplate {
  return {
    ...template,
    bands: template.bands.map((band) => ({
      ...band,
      elements: band.elements.map((el) => (el.id === id ? update(el) : el)),
    })),
  }
}

/**
 * Returns a new template with each named element's rect replaced by the rect
 * mapped to its id. The original template is not mutated; elements whose id is
 * not in `rects` (and all their other fields) are left unchanged. Used to apply
 * an alignment or distribution to several selected elements at once, across
 * bands, in a single immutable update.
 *
 * @param template The template to update.
 * @param rects A map from element id to its new {@link Rect}.
 * @returns A new {@link ReportTemplate} with the listed elements repositioned.
 */
export function updateElementRects(
  template: ReportTemplate,
  rects: ReadonlyMap<string, Rect>,
): ReportTemplate {
  if (rects.size === 0) return template
  return {
    ...template,
    bands: template.bands.map((band) => ({
      ...band,
      elements: band.elements.map((el) => {
        const rect = rects.get(el.id)
        return rect ? { ...el, rect } : el
      }),
    })),
  }
}

/**
 * Returns a new template with `patch` merged into its designer settings. The
 * original template is not mutated; its bands and page are shared by reference,
 * as only the settings change.
 *
 * @param template The template whose settings to update.
 * @param patch The settings fields to change (e.g. `{ snapToGrid: false }`).
 * @returns A new {@link ReportTemplate} with the updated settings.
 */
export function updateSettings(
  template: ReportTemplate,
  patch: Partial<BuilderSettings>,
): ReportTemplate {
  return { ...template, settings: { ...template.settings, ...patch } }
}

/** Default size and offset (inches) for a freshly inserted element of each type. */
const DEFAULT_RECTS: Record<ElementType, Rect> = {
  label: { x: 0.5, y: 0.1, w: 2, h: 0.25 },
  dataField: { x: 0.5, y: 0.1, w: 2, h: 0.25 },
  formula: { x: 0.5, y: 0.1, w: 2, h: 0.25 },
  line: { x: 0.5, y: 0.1, w: 2, h: 0 },
  rectangle: { x: 0.5, y: 0.1, w: 1.5, h: 0.75 },
  triangle: { x: 0.5, y: 0.1, w: 1, h: 0.75 },
  ellipse: { x: 0.5, y: 0.1, w: 1, h: 1 },
  image: { x: 0.5, y: 0.1, w: 1.5, h: 1 },
  barcode: { x: 0.5, y: 0.1, w: 1.5, h: 0.5 },
  subReport: { x: 0.5, y: 0.1, w: 4, h: 1 },
  table: { x: 0.5, y: 0.1, w: 4, h: 1 },
  chart: { x: 0.5, y: 0.1, w: 3, h: 2 },
  pageBreak: { x: 0, y: 0.1, w: 6.5, h: 0.1 },
}

/** Default text for the text-bearing element types; other types start textless. */
const DEFAULT_TEXT: Partial<Record<ElementType, string>> = {
  label: 'Label',
  dataField: '{Field}',
  formula: 'SUM()',
}

/** Default designer expression for the binding-bearing element types. */
const DEFAULT_EXPRESSION: Partial<Record<ElementType, string>> = {
  dataField: '{Field}',
  formula: 'SUM()',
}

/**
 * Builds a new element of the given type with sensible default geometry and, for
 * text/binding types, default text and expression. The element is otherwise
 * unstyled (canvas defaults) and ready to drop into a band.
 *
 * @param type The kind of element to create.
 * @param id Stable id for the new element, unique within the template (see
 * {@link nextElementId}).
 * @returns A fresh {@link ReportElement}.
 */
export function createElement(type: ElementType, id: string): ReportElement {
  const element: ReportElement = { id, type, rect: { ...DEFAULT_RECTS[type] } }
  if (DEFAULT_TEXT[type] !== undefined) element.text = DEFAULT_TEXT[type]
  if (DEFAULT_EXPRESSION[type] !== undefined) element.expression = DEFAULT_EXPRESSION[type]
  return element
}

/**
 * Generates the next unused id for an element of the given type, of the form
 * `"{type}-{n}"`, where `n` is the smallest positive integer not already used by
 * any element in the template.
 *
 * @param template The template the element will be added to.
 * @param type The element type the id is for.
 * @returns A stable id unique across all bands of `template`.
 */
export function nextElementId(template: ReportTemplate, type: ElementType): string {
  const used = new Set(template.bands.flatMap((band) => band.elements.map((el) => el.id)))
  let n = 1
  while (used.has(`${type}-${n}`)) n++
  return `${type}-${n}`
}

/**
 * Returns a new template with `element` appended to the named band's elements.
 * The original template is not mutated; bands other than `bandKind` are returned
 * unchanged.
 *
 * @param template The template to add to.
 * @param bandKind The band that should receive the element.
 * @param element The element to append.
 * @returns A new {@link ReportTemplate} with the element added.
 */
export function addElement(
  template: ReportTemplate,
  bandKind: BandKind,
  element: ReportElement,
): ReportTemplate {
  return {
    ...template,
    bands: template.bands.map((band) =>
      band.kind === bandKind ? { ...band, elements: [...band.elements, element] } : band,
    ),
  }
}

/**
 * Finds which band holds the element with the given id.
 *
 * @param template The template to search.
 * @param id The element id, or `null` for "no selection".
 * @returns The {@link BandKind} of the band containing the element, or `null` if
 * `id` is `null` or no element has that id.
 */
export function bandKindOf(template: ReportTemplate, id: string | null): BandKind | null {
  if (id === null) return null
  for (const band of template.bands) {
    if (band.elements.some((el) => el.id === id)) return band.kind
  }
  return null
}
