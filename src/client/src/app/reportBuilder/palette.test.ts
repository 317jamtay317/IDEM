import { describe, it, expect } from 'vitest'
import { ELEMENT_TYPE_LABELS } from './elementDisplay'
import { PALETTE_GROUPS } from './palette'

describe('PALETTE_GROUPS', () => {
  it('groups the palette into Text, Shapes, Media and Advanced', () => {
    expect(PALETTE_GROUPS.map((g) => g.name)).toEqual(['Text', 'Shapes', 'Media', 'Advanced'])
  })

  it('leads with the text types in author order', () => {
    expect(PALETTE_GROUPS[0].types).toEqual(['label', 'formula', 'dataField'])
  })

  it('offers the advanced container types', () => {
    const types = PALETTE_GROUPS.flatMap((g) => g.types)

    expect(types).toEqual(expect.arrayContaining(['subReport', 'table', 'chart', 'pageBreak']))
  })

  it('offers each element type at most once, every one with a display label', () => {
    const types = PALETTE_GROUPS.flatMap((g) => g.types)

    expect(new Set(types).size).toBe(types.length)
    for (const type of types) {
      expect(ELEMENT_TYPE_LABELS[type]).toBeTruthy()
    }
  })
})
