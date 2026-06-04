import { describe, it, expect } from 'vitest'
import { createSampleTemplate } from './sampleTemplate'
import { BAND_ORDER, type ElementType } from './model'
import { parseRdl, toRdl } from './rdl'

describe('createSampleTemplate', () => {
  it('uses the IDEM Annual Emissions Inventory as its default identity', () => {
    const t = createSampleTemplate()

    expect(t.id).toBe('annual-emissions')
    expect(t.name).toBe('Annual Emissions Inventory')
  })

  it('accepts an overriding id and name', () => {
    const t = createSampleTemplate('q2-opacity', 'Q2 Opacity Report')

    expect(t.id).toBe('q2-opacity')
    expect(t.name).toBe('Q2 Opacity Report')
  })

  it('populates every band so the canvas has something to show', () => {
    const t = createSampleTemplate()

    expect(t.bands.map((b) => b.kind)).toEqual(BAND_ORDER)
    expect(t.bands.every((b) => b.elements.length > 0)).toBe(true)
  })

  it('exercises a spread of element types', () => {
    const types = new Set<ElementType>(
      createSampleTemplate().bands.flatMap((b) => b.elements.map((e) => e.type)),
    )

    for (const type of ['label', 'dataField', 'formula', 'image', 'line'] as ElementType[]) {
      expect(types).toContain(type)
    }
  })

  it('round-trips losslessly through RDL (uses only modelled features)', () => {
    const t = createSampleTemplate()

    expect(parseRdl(toRdl(t))).toEqual(t)
  })
})
