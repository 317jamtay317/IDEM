import { describe, it, expect } from 'vitest'
import { ELEMENT_DRAG_MIME, isElementType } from './dnd'

describe('ELEMENT_DRAG_MIME', () => {
  it('is a custom application MIME type for dragging element types', () => {
    expect(ELEMENT_DRAG_MIME).toMatch(/^application\//)
  })
})

describe('isElementType', () => {
  it('accepts every known element type', () => {
    for (const type of ['label', 'formula', 'dataField', 'line', 'rectangle', 'triangle', 'ellipse', 'image', 'barcode', 'subReport', 'table', 'chart', 'pageBreak']) {
      expect(isElementType(type)).toBe(true)
    }
  })

  it('rejects unknown or empty strings', () => {
    expect(isElementType('')).toBe(false)
    expect(isElementType('nope')).toBe(false)
  })

  it('rejects inherited Object property names', () => {
    expect(isElementType('constructor')).toBe(false)
    expect(isElementType('toString')).toBe(false)
  })
})
