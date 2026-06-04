/**
 * Serialization between the in-memory {@link ReportTemplate} model and RDL/RDLC
 * XML (Microsoft Report Definition Language). The mapping targets a pragmatic
 * RDLC subset: the real RDL `Report` / `Page` / `Body` / `ReportItems` shell,
 * with report bands represented as RDL `Rectangle` containers and designer
 * metadata RDL has no native home for (template id/version, builder settings,
 * band kind, element kind and designer expression) carried in a custom
 * namespace ({@link RK_NAMESPACE}). Geometry is emitted in inches, RDL's unit.
 *
 * `toRdl` / `parseRdl` are exact inverses for any template the model can hold.
 */
import {
  type Band,
  type BandKind,
  type ElementStyle,
  type FontWeight,
  type PageSetup,
  type Rect,
  type ReportElement,
  type ReportTemplate,
  type TextAlign,
} from './model'

/** The RDL 2016 report-definition namespace. */
export const RDL_NAMESPACE =
  'http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition'

/** Custom namespace for Report Builder metadata that RDL has no native home for. */
export const RK_NAMESPACE = 'urn:recordkeeping:reportbuilder:v1'

/** Escapes text/attribute content for inclusion in XML. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Formats an inches value as an RDL size string, e.g. `8.5in`. */
function size(inches: number): string {
  return `${inches}in`
}

/** Designer font weight → RDL `FontWeight` value, and the inverse. */
const FONT_WEIGHT_RDL: Record<FontWeight, string> = {
  normal: 'Normal',
  medium: 'Medium',
  semibold: 'SemiBold',
  bold: 'Bold',
}
const RDL_FONT_WEIGHT: Record<string, FontWeight> = {
  Normal: 'normal',
  Medium: 'medium',
  SemiBold: 'semibold',
  Bold: 'bold',
}

/** Designer alignment → RDL `TextAlign` value, and the inverse. */
const ALIGN_RDL: Record<TextAlign, string> = { left: 'Left', center: 'Center', right: 'Right' }
const RDL_ALIGN: Record<string, TextAlign> = { Left: 'left', Center: 'center', Right: 'right' }

/** Whether a style has any property worth serializing. */
function styleHasContent(s: ElementStyle): boolean {
  return (
    s.fontFamily !== undefined ||
    s.fontSize !== undefined ||
    s.fontWeight !== undefined ||
    s.italic === true ||
    s.underline === true ||
    s.align !== undefined ||
    s.color !== undefined
  )
}

/** Appends an RDL `<Style>` block for the element's style at the given indent. */
function appendStyle(lines: string[], style: ElementStyle, pad: string): void {
  lines.push(`${pad}<Style>`)
  if (style.fontFamily !== undefined)
    lines.push(`${pad}  <FontFamily>${escapeXml(style.fontFamily)}</FontFamily>`)
  if (style.fontSize !== undefined) lines.push(`${pad}  <FontSize>${style.fontSize}pt</FontSize>`)
  if (style.fontWeight !== undefined)
    lines.push(`${pad}  <FontWeight>${FONT_WEIGHT_RDL[style.fontWeight]}</FontWeight>`)
  if (style.italic === true) lines.push(`${pad}  <FontStyle>Italic</FontStyle>`)
  if (style.underline === true) lines.push(`${pad}  <TextDecoration>Underline</TextDecoration>`)
  if (style.align !== undefined) lines.push(`${pad}  <TextAlign>${ALIGN_RDL[style.align]}</TextAlign>`)
  if (style.color !== undefined) lines.push(`${pad}  <Color>${escapeXml(style.color)}</Color>`)
  lines.push(`${pad}</Style>`)
}

/** Reads an RDL `<Style>` element into an {@link ElementStyle}. */
function parseStyle(styleEl: Element): ElementStyle {
  const style: ElementStyle = {}
  const family = childOf(styleEl, 'FontFamily')?.textContent
  if (family != null) style.fontFamily = family
  const fontSize = childOf(styleEl, 'FontSize')?.textContent
  if (fontSize != null) style.fontSize = parseFloat(fontSize)
  const weight = childOf(styleEl, 'FontWeight')?.textContent
  if (weight != null) style.fontWeight = RDL_FONT_WEIGHT[weight]
  if (childOf(styleEl, 'FontStyle')?.textContent === 'Italic') style.italic = true
  if (childOf(styleEl, 'TextDecoration')?.textContent === 'Underline') style.underline = true
  const align = childOf(styleEl, 'TextAlign')?.textContent
  if (align != null) style.align = RDL_ALIGN[align]
  const color = childOf(styleEl, 'Color')?.textContent
  if (color != null) style.color = color
  return style
}

/** The RDL element name used to serialize a given element type. */
function rdlTag(type: ReportElement['type']): string {
  switch (type) {
    case 'line':
      return 'Line'
    case 'image':
      return 'Image'
    case 'label':
    case 'dataField':
    case 'formula':
      return 'Textbox'
    default:
      // Shapes and advanced container types (rectangle, triangle, ellipse,
      // barcode, subReport, table, chart, pageBreak) serialize as RDL Rectangles;
      // their precise kind is carried by the rk:Element marker.
      return 'Rectangle'
  }
}

/** Appends the lines for a single element at the given indentation. */
function appendElement(lines: string[], el: ReportElement, indent: number): void {
  const pad = ' '.repeat(indent)
  const tag = rdlTag(el.type)
  const expr = el.expression !== undefined ? ` expression="${escapeXml(el.expression)}"` : ''

  lines.push(`${pad}<${tag} Name="${escapeXml(el.id)}">`)
  lines.push(`${pad}  <rk:Element type="${el.type}"${expr}/>`)
  lines.push(`${pad}  <Top>${size(el.rect.y)}</Top>`)
  lines.push(`${pad}  <Left>${size(el.rect.x)}</Left>`)
  lines.push(`${pad}  <Height>${size(el.rect.h)}</Height>`)
  lines.push(`${pad}  <Width>${size(el.rect.w)}</Width>`)
  if (el.style && styleHasContent(el.style)) appendStyle(lines, el.style, `${pad}  `)
  if (el.text !== undefined) {
    lines.push(`${pad}  <Value>${escapeXml(el.text)}</Value>`)
  }
  lines.push(`${pad}</${tag}>`)
}

/**
 * Serializes a {@link ReportTemplate} to an RDL/RDLC document. The output is
 * deterministic (stable element order and indentation) so it diffs and snapshots
 * cleanly.
 *
 * @param template The template to serialize.
 * @returns The RDL XML document as a string.
 */
export function toRdl(template: ReportTemplate): string {
  const { page, settings } = template
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="utf-8"?>')
  lines.push(`<Report xmlns="${RDL_NAMESPACE}" xmlns:rk="${RK_NAMESPACE}">`)
  lines.push(
    `  <rk:Template id="${escapeXml(template.id)}" name="${escapeXml(template.name)}"` +
      ` version="${template.version}" snapToGrid="${settings.snapToGrid}"` +
      ` gridSize="${settings.gridSize}"/>`,
  )
  lines.push('  <Page>')
  lines.push(`    <PageHeight>${size(page.height)}</PageHeight>`)
  lines.push(`    <PageWidth>${size(page.width)}</PageWidth>`)
  lines.push(`    <TopMargin>${size(page.margins.top)}</TopMargin>`)
  lines.push(`    <RightMargin>${size(page.margins.right)}</RightMargin>`)
  lines.push(`    <BottomMargin>${size(page.margins.bottom)}</BottomMargin>`)
  lines.push(`    <LeftMargin>${size(page.margins.left)}</LeftMargin>`)
  lines.push('  </Page>')
  lines.push('  <Body>')
  lines.push('    <ReportItems>')
  for (const band of template.bands) {
    lines.push(`      <Rectangle Name="Band_${band.kind}">`)
    lines.push(`        <rk:Band kind="${band.kind}"/>`)
    lines.push(`        <Height>${size(band.height)}</Height>`)
    lines.push('        <ReportItems>')
    for (const el of band.elements) {
      appendElement(lines, el, 10)
    }
    lines.push('        </ReportItems>')
    lines.push('      </Rectangle>')
  }
  lines.push('    </ReportItems>')
  lines.push('  </Body>')
  lines.push('</Report>')

  return lines.join('\n') + '\n'
}

/** Direct element children of `el` with the given local name (and optional namespace). */
function childrenOf(el: Element, localName: string, ns?: string): Element[] {
  return Array.from(el.children).filter(
    (c) => c.localName === localName && (ns === undefined || c.namespaceURI === ns),
  )
}

/** The first direct child of `el` with the given local name (and optional namespace). */
function childOf(el: Element, localName: string, ns?: string): Element | undefined {
  return childrenOf(el, localName, ns)[0]
}

/** Reads a direct child size element (e.g. `<Width>3in</Width>`) as inches. */
function sizeOf(el: Element, localName: string): number {
  return parseFloat(childOf(el, localName)?.textContent ?? '0')
}

/** Parses one report item; returns `undefined` for items the model does not represent. */
function parseElement(el: Element): ReportElement | undefined {
  const meta = childOf(el, 'Element', RK_NAMESPACE)
  if (!meta) return undefined // tolerate foreign / non-modelled RDL items

  const rect: Rect = {
    x: sizeOf(el, 'Left'),
    y: sizeOf(el, 'Top'),
    w: sizeOf(el, 'Width'),
    h: sizeOf(el, 'Height'),
  }
  const parsed: ReportElement = {
    id: el.getAttribute('Name') ?? '',
    type: meta.getAttribute('type') as ReportElement['type'],
    rect,
  }

  const expression = meta.getAttribute('expression')
  if (expression !== null) parsed.expression = expression

  const value = childOf(el, 'Value')
  if (value) parsed.text = value.textContent ?? ''

  const styleEl = childOf(el, 'Style')
  if (styleEl) parsed.style = parseStyle(styleEl)

  return parsed
}

/** Parses one band (an RDL `Rectangle` tagged with `rk:Band`). */
function parseBand(rect: Element): Band {
  const meta = childOf(rect, 'Band', RK_NAMESPACE)
  const items = childOf(rect, 'ReportItems')
  const elements = items
    ? Array.from(items.children)
        .map(parseElement)
        .filter((e): e is ReportElement => e !== undefined)
    : []

  return {
    kind: (meta?.getAttribute('kind') ?? '') as BandKind,
    height: sizeOf(rect, 'Height'),
    elements,
  }
}

/**
 * Parses an RDL/RDLC document produced by {@link toRdl} back into a
 * {@link ReportTemplate}. Foreign report items (those without the Report Builder
 * `rk:Element` marker) are skipped rather than rejected.
 *
 * @param xml The RDL XML document.
 * @returns The reconstructed template.
 * @throws Error if the document is not well-formed or is missing the template marker.
 */
export function parseRdl(xml: string): ReportTemplate {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid RDL: document is not well-formed XML.')
  }

  const report = doc.documentElement
  const tpl = childOf(report, 'Template', RK_NAMESPACE)
  if (!tpl) throw new Error('Invalid RDL: missing rk:Template metadata.')

  const pageEl = childOf(report, 'Page')
  if (!pageEl) throw new Error('Invalid RDL: missing Page.')
  const page: PageSetup = {
    width: sizeOf(pageEl, 'PageWidth'),
    height: sizeOf(pageEl, 'PageHeight'),
    margins: {
      top: sizeOf(pageEl, 'TopMargin'),
      right: sizeOf(pageEl, 'RightMargin'),
      bottom: sizeOf(pageEl, 'BottomMargin'),
      left: sizeOf(pageEl, 'LeftMargin'),
    },
  }

  const body = childOf(report, 'Body')
  const bodyItems = body ? childOf(body, 'ReportItems') : undefined
  const bands = bodyItems ? childrenOf(bodyItems, 'Rectangle').map(parseBand) : []

  return {
    id: tpl.getAttribute('id') ?? '',
    name: tpl.getAttribute('name') ?? '',
    version: Number(tpl.getAttribute('version') ?? '0'),
    page,
    bands,
    settings: {
      snapToGrid: tpl.getAttribute('snapToGrid') === 'true',
      gridSize: Number(tpl.getAttribute('gridSize') ?? '0'),
    },
  }
}
