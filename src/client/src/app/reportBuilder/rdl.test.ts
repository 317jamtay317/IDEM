import { describe, it, expect } from 'vitest'
import { createElement, createEmptyTemplate, type ReportTemplate } from './model'
import { RDL_NAMESPACE, RK_NAMESPACE, parseRdl, toRdl } from './rdl'

/** A template exercising every modelled element type across several bands. */
function populatedTemplate(): ReportTemplate {
  const t = createEmptyTemplate('annual-emissions', 'Annual Emissions Inventory')

  const reportHeader = t.bands.find((b) => b.kind === 'reportHeader')!
  reportHeader.elements.push(
    {
      id: 'title',
      type: 'label',
      rect: { x: 0.42, y: 0.44, w: 3.1, h: 0.3 },
      text: 'Annual Emissions Inventory',
    },
    {
      id: 'facility',
      type: 'dataField',
      rect: { x: 0.42, y: 0.8, w: 3, h: 0.25 },
      text: '{Facility.Name}',
      expression: '{Facility.Name}',
    },
    { id: 'logo', type: 'image', rect: { x: 6, y: 0.4, w: 1.5, h: 1 } },
  )

  const detail = t.bands.find((b) => b.kind === 'detail')!
  detail.elements.push(
    {
      id: 'tons',
      type: 'dataField',
      rect: { x: 3, y: 0, w: 1, h: 0.25 },
      text: '{Record.Tons}',
      expression: '{Record.Tons}',
    },
    { id: 'rule', type: 'line', rect: { x: 0, y: 0.28, w: 7, h: 0 } },
  )

  const footer = t.bands.find((b) => b.kind === 'pageFooter')!
  footer.elements.push(
    {
      id: 'total',
      type: 'formula',
      rect: { x: 3, y: 0, w: 1.5, h: 0.25 },
      text: 'Σ {=SUM(Tons)}',
      expression: 'SUM({Record.Tons})',
    },
    { id: 'box', type: 'rectangle', rect: { x: 0, y: 0, w: 2, h: 0.2 } },
  )

  return t
}

describe('toRdl / parseRdl', () => {
  it('round-trips an empty template losslessly', () => {
    const t = createEmptyTemplate('t1', 'Blank')

    expect(parseRdl(toRdl(t))).toEqual(t)
  })

  it('round-trips a populated template losslessly (all element types, several bands)', () => {
    const t = populatedTemplate()

    expect(parseRdl(toRdl(t))).toEqual(t)
  })

  it('round-trips snap-to-grid settings (toggle off and a custom grid size)', () => {
    const t = createEmptyTemplate('t1', 'Blank')
    t.settings = { snapToGrid: false, gridSize: 0.25 }

    const back = parseRdl(toRdl(t))
    expect(back.settings).toEqual({ snapToGrid: false, gridSize: 0.25 })
  })

  it('emits an RDL document carrying the namespace and schema version (I-D08)', () => {
    const xml = toRdl(createEmptyTemplate('t1', 'Blank'))

    expect(xml).toContain(RDL_NAMESPACE)
    expect(xml).toMatch(/version="1"/)
  })

  it('preserves element order within a band', () => {
    const ids = parseRdl(toRdl(populatedTemplate()))
      .bands.find((b) => b.kind === 'reportHeader')!
      .elements.map((e) => e.id)

    expect(ids).toEqual(['title', 'facility', 'logo'])
  })

  it('distinguishes a label with empty text from one with no text', () => {
    const t = createEmptyTemplate('t1', 'Blank')
    t.bands[0].elements.push(
      { id: 'empty', type: 'label', rect: { x: 0, y: 0, w: 1, h: 0.2 }, text: '' },
      { id: 'none', type: 'label', rect: { x: 0, y: 0.3, w: 1, h: 0.2 } },
    )

    const back = parseRdl(toRdl(t)).bands[0].elements
    expect(back[0].text).toBe('')
    expect(back[1].text).toBeUndefined()
  })

  it('escapes XML-special characters in names and text and round-trips them', () => {
    const t = createEmptyTemplate('t1', 'A & B <co> "x"')
    t.bands[0].elements.push({
      id: 'amp',
      type: 'label',
      rect: { x: 0, y: 0, w: 1, h: 0.2 },
      text: '5 < 6 & "ok"',
    })

    expect(parseRdl(toRdl(t))).toEqual(t)
  })

  it('emits the five bands in canonical order with well-formed RDL', () => {
    const xml = toRdl(createEmptyTemplate('t1', 'Blank'))

    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true)
    expect(xml).toContain(`<Report xmlns="${RDL_NAMESPACE}" xmlns:rk="${RK_NAMESPACE}">`)
    expect(xml).toContain('<PageWidth>8.5in</PageWidth>')
    const order = [...xml.matchAll(/<rk:Band kind="(\w+)"/g)].map((m) => m[1])
    expect(order).toEqual(['reportHeader', 'pageHeader', 'detail', 'subReport', 'pageFooter'])
  })

  it('tolerates RDL report items it does not model (skips them)', () => {
    const t = createEmptyTemplate('t1', 'Blank')
    // Inject a foreign RDL item (no rk:Element marker) into the first band's items.
    const xml = toRdl(t).replace(
      /(<rk:Band kind="reportHeader"\/>[\s\S]*?<ReportItems>)/,
      '$1<Textbox Name="foreign"><Top>0in</Top></Textbox>',
    )

    const back = parseRdl(xml)
    expect(back.bands[0].elements).toEqual([])
  })
})

describe('toRdl / parseRdl — palette element types', () => {
  it('round-trips the shape, media and advanced element types losslessly', () => {
    const t = createEmptyTemplate('t1', 'Palette')
    t.bands[0].elements.push(
      createElement('triangle', 'triangle-1'),
      createElement('ellipse', 'ellipse-1'),
      createElement('barcode', 'barcode-1'),
      createElement('subReport', 'subReport-1'),
      createElement('table', 'table-1'),
      createElement('chart', 'chart-1'),
      createElement('pageBreak', 'pageBreak-1'),
    )

    expect(parseRdl(toRdl(t))).toEqual(t)
  })

  it('serializes a container element type inside an RDL <Rectangle>', () => {
    const t = createEmptyTemplate('t1', 'Adv')
    t.bands[0].elements.push(createElement('table', 'table-1'))

    expect(toRdl(t)).toContain('<Rectangle Name="table-1">')
  })
})

describe('toRdl / parseRdl — element style', () => {
  it('round-trips an element with full styling', () => {
    const t = createEmptyTemplate('t1', 'Styled')
    t.bands[0].elements.push({
      id: 'title',
      type: 'label',
      rect: { x: 0, y: 0, w: 3, h: 0.3 },
      text: 'Title',
      style: {
        fontFamily: 'Inter',
        fontSize: 22,
        fontWeight: 'semibold',
        italic: true,
        underline: true,
        align: 'center',
        color: '#0F172A',
      },
    })

    expect(parseRdl(toRdl(t))).toEqual(t)
  })

  it('round-trips an element with partial styling', () => {
    const t = createEmptyTemplate('t1', 'Styled')
    t.bands[0].elements.push({
      id: 'sub',
      type: 'label',
      rect: { x: 0, y: 0, w: 3, h: 0.3 },
      text: 'Sub',
      style: { fontSize: 11, color: '#475569' },
    })

    expect(parseRdl(toRdl(t))).toEqual(t)
  })

  it('emits an RDL <Style> with mapped font, alignment and colour values', () => {
    const t = createEmptyTemplate('t1', 'Styled')
    t.bands[0].elements.push({
      id: 'title',
      type: 'label',
      rect: { x: 0, y: 0, w: 3, h: 0.3 },
      text: 'Title',
      style: { fontSize: 22, fontWeight: 'semibold', italic: true, underline: true, align: 'center', color: '#0F172A' },
    })

    const xml = toRdl(t)
    expect(xml).toContain('<FontSize>22pt</FontSize>')
    expect(xml).toContain('<FontWeight>SemiBold</FontWeight>')
    expect(xml).toContain('<FontStyle>Italic</FontStyle>')
    expect(xml).toContain('<TextDecoration>Underline</TextDecoration>')
    expect(xml).toContain('<TextAlign>Center</TextAlign>')
    expect(xml).toContain('<Color>#0F172A</Color>')
  })

  it('omits the Style element when an element has no style', () => {
    const t = createEmptyTemplate('t1', 'Plain')
    t.bands[0].elements.push({ id: 'x', type: 'label', rect: { x: 0, y: 0, w: 1, h: 0.2 }, text: 'X' })

    expect(toRdl(t)).not.toContain('<Style>')
  })
})

describe('parseRdl — invalid input', () => {
  it('throws on XML that is not well-formed', () => {
    expect(() => parseRdl('<Report><oops></Report>')).toThrow(/Invalid RDL/i)
  })

  it('throws when the template marker is missing', () => {
    const xml = toRdl(createEmptyTemplate('t1', 'Blank')).replace(/<rk:Template[\s\S]*?\/>/, '')

    expect(() => parseRdl(xml)).toThrow(/rk:Template/i)
  })

  it('throws when the Page is missing', () => {
    const xml = toRdl(createEmptyTemplate('t1', 'Blank')).replace(/<Page>[\s\S]*?<\/Page>/, '')

    expect(() => parseRdl(xml)).toThrow(/Page/i)
  })

  it('parses a band that has no report items as an empty band', () => {
    // Drop the first (reportHeader) band's empty <ReportItems> entirely.
    const xml = toRdl(createEmptyTemplate('t1', 'Blank')).replace(
      /<ReportItems>\s*<\/ReportItems>/,
      '',
    )

    expect(parseRdl(xml).bands[0].elements).toEqual([])
  })

  it('fills in defaults when optional metadata, attributes, and body are absent', () => {
    const xml =
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<Report xmlns="${RDL_NAMESPACE}" xmlns:rk="${RK_NAMESPACE}">\n` +
      `  <rk:Template/>\n` +
      `  <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth>` +
      `<TopMargin>1in</TopMargin><RightMargin>1in</RightMargin>` +
      `<BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>\n` +
      `</Report>\n`

    const t = parseRdl(xml)
    expect(t.id).toBe('')
    expect(t.name).toBe('')
    expect(t.version).toBe(0)
    expect(t.settings).toEqual({ snapToGrid: false, gridSize: 0 })
    expect(t.bands).toEqual([])
  })
})
