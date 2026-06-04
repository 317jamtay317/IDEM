import { describe, it, expect } from 'vitest'
import {
  BAND_ORDER,
  TEMPLATE_VERSION,
  addElement,
  bandKindOf,
  createElement,
  createEmptyTemplate,
  findElement,
  nextElementId,
  updateElement,
} from './model'

describe('createEmptyTemplate', () => {
  it('creates a template with the given id and name at the current version', () => {
    const t = createEmptyTemplate('annual-emissions', 'Annual Emissions Inventory')

    expect(t.id).toBe('annual-emissions')
    expect(t.name).toBe('Annual Emissions Inventory')
    expect(t.version).toBe(TEMPLATE_VERSION)
  })

  it('starts with the five report bands in canonical order, each empty', () => {
    const t = createEmptyTemplate('t1', 'T1')

    expect(t.bands.map((b) => b.kind)).toEqual([
      'reportHeader',
      'pageHeader',
      'detail',
      'subReport',
      'pageFooter',
    ])
    expect(t.bands.every((b) => b.elements.length === 0)).toBe(true)
    expect(t.bands.every((b) => b.height > 0)).toBe(true)
  })

  it('defaults the page to US Letter with one-inch margins (inches)', () => {
    const t = createEmptyTemplate('t1', 'T1')

    expect(t.page.width).toBe(8.5)
    expect(t.page.height).toBe(11)
    expect(t.page.margins).toEqual({ top: 1, right: 1, bottom: 1, left: 1 })
  })

  it('enables snap-to-grid with an eighth-inch grid by default', () => {
    const t = createEmptyTemplate('t1', 'T1')

    expect(t.settings).toEqual({ snapToGrid: true, gridSize: 0.125 })
  })

  it('exposes the canonical top-to-bottom band order', () => {
    expect(BAND_ORDER).toEqual([
      'reportHeader',
      'pageHeader',
      'detail',
      'subReport',
      'pageFooter',
    ])
  })
})

describe('findElement', () => {
  it('finds an element by id regardless of which band holds it', () => {
    const t = createEmptyTemplate('t1', 'T1')
    t.bands
      .find((b) => b.kind === 'detail')!
      .elements.push({ id: 'tons', type: 'label', rect: { x: 0, y: 0, w: 1, h: 0.2 }, text: 'T' })

    expect(findElement(t, 'tons')?.id).toBe('tons')
  })

  it('returns null for an unknown id', () => {
    expect(findElement(createEmptyTemplate('t1', 'T1'), 'missing')).toBeNull()
  })

  it('returns null when the id is null', () => {
    expect(findElement(createEmptyTemplate('t1', 'T1'), null)).toBeNull()
  })
})

describe('updateElement', () => {
  /** A template with two elements in the detail band. */
  function withTwo() {
    const t = createEmptyTemplate('t1', 'T1')
    t.bands
      .find((b) => b.kind === 'detail')!
      .elements.push(
        { id: 'a', type: 'label', rect: { x: 0, y: 0, w: 1, h: 0.2 }, text: 'A' },
        { id: 'b', type: 'label', rect: { x: 0, y: 0, w: 1, h: 0.2 }, text: 'B' },
      )
    return t
  }

  it('applies the update to the matching element and leaves the others alone', () => {
    const next = updateElement(withTwo(), 'a', (el) => ({ ...el, text: 'A!' }))

    expect(findElement(next, 'a')!.text).toBe('A!')
    expect(findElement(next, 'b')!.text).toBe('B')
  })

  it('does not mutate the original template', () => {
    const original = withTwo()

    const next = updateElement(original, 'a', (el) => ({ ...el, text: 'changed' }))

    expect(findElement(original, 'a')!.text).toBe('A')
    expect(next).not.toBe(original)
  })

  it('returns an equivalent template when the id is not found', () => {
    const t = withTwo()

    expect(updateElement(t, 'missing', (el) => ({ ...el, text: 'x' }))).toEqual(t)
  })
})

describe('createElement', () => {
  it('creates an element of the requested type with the given id', () => {
    const el = createElement('rectangle', 'rectangle-1')

    expect(el.id).toBe('rectangle-1')
    expect(el.type).toBe('rectangle')
  })

  it('gives the element a positive-width default rect', () => {
    expect(createElement('label', 'label-1').rect.w).toBeGreaterThan(0)
  })

  it('seeds a label with default text so it is visible once placed', () => {
    expect(createElement('label', 'label-1').text).toBe('Label')
  })

  it('seeds a data field with a default binding expression and token text', () => {
    const el = createElement('dataField', 'dataField-1')

    expect(el.expression).toBeDefined()
    expect(el.text).toBeDefined()
  })

  it('leaves a shape element without text or binding', () => {
    const el = createElement('line', 'line-1')

    expect(el.text).toBeUndefined()
    expect(el.expression).toBeUndefined()
  })

  it('creates each advanced palette type the builder offers', () => {
    const advanced = ['triangle', 'ellipse', 'barcode', 'subReport', 'table', 'chart', 'pageBreak'] as const
    for (const type of advanced) {
      expect(createElement(type, `${type}-1`).type).toBe(type)
    }
  })
})

describe('nextElementId', () => {
  it('numbers the first element of a type from one', () => {
    expect(nextElementId(createEmptyTemplate('t1', 'T1'), 'label')).toBe('label-1')
  })

  it('skips ids already used anywhere in the template', () => {
    const t = createEmptyTemplate('t1', 'T1')
    t.bands.find((b) => b.kind === 'detail')!.elements.push(createElement('label', 'label-1'))

    expect(nextElementId(t, 'label')).toBe('label-2')
  })
})

describe('addElement', () => {
  it('appends the element to the named band', () => {
    const t = addElement(createEmptyTemplate('t1', 'T1'), 'detail', createElement('label', 'label-1'))

    expect(t.bands.find((b) => b.kind === 'detail')!.elements.map((e) => e.id)).toEqual(['label-1'])
  })

  it('does not mutate the original template', () => {
    const original = createEmptyTemplate('t1', 'T1')

    const next = addElement(original, 'detail', createElement('label', 'label-1'))

    expect(original.bands.find((b) => b.kind === 'detail')!.elements).toHaveLength(0)
    expect(next).not.toBe(original)
  })

  it('leaves the other bands untouched', () => {
    const t = addElement(createEmptyTemplate('t1', 'T1'), 'detail', createElement('label', 'label-1'))

    expect(t.bands.find((b) => b.kind === 'reportHeader')!.elements).toHaveLength(0)
  })
})

describe('bandKindOf', () => {
  it('returns the band kind that holds the element', () => {
    const t = addElement(createEmptyTemplate('t1', 'T1'), 'pageFooter', createElement('label', 'label-1'))

    expect(bandKindOf(t, 'label-1')).toBe('pageFooter')
  })

  it('returns null for an unknown id', () => {
    expect(bandKindOf(createEmptyTemplate('t1', 'T1'), 'missing')).toBeNull()
  })

  it('returns null when the id is null', () => {
    expect(bandKindOf(createEmptyTemplate('t1', 'T1'), null)).toBeNull()
  })
})
