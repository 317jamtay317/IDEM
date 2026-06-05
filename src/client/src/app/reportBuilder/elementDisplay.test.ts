import { describe, it, expect } from 'vitest'
import { ELEMENT_TYPE_LABELS, fromDisplayPx, toDisplayPx } from './elementDisplay'

describe('ELEMENT_TYPE_LABELS', () => {
  it('gives each element type a human-readable label', () => {
    expect(ELEMENT_TYPE_LABELS.label).toBe('Label')
    expect(ELEMENT_TYPE_LABELS.dataField).toBe('Data Field')
    expect(ELEMENT_TYPE_LABELS.formula).toBe('Formula')
    expect(ELEMENT_TYPE_LABELS.line).toBe('Line')
    expect(ELEMENT_TYPE_LABELS.rectangle).toBe('Rectangle')
    expect(ELEMENT_TYPE_LABELS.image).toBe('Image')
  })

  it('labels the shape, media and advanced palette types', () => {
    expect(ELEMENT_TYPE_LABELS.triangle).toBe('Triangle')
    expect(ELEMENT_TYPE_LABELS.ellipse).toBe('Ellipse')
    expect(ELEMENT_TYPE_LABELS.barcode).toBe('Barcode')
    expect(ELEMENT_TYPE_LABELS.subReport).toBe('Sub Report')
    expect(ELEMENT_TYPE_LABELS.table).toBe('Table')
    expect(ELEMENT_TYPE_LABELS.chart).toBe('Chart')
    expect(ELEMENT_TYPE_LABELS.pageBreak).toBe('Page Break')
  })
})

describe('toDisplayPx', () => {
  it('converts inches to whole pixels at the reference resolution', () => {
    expect(toDisplayPx(1)).toBe(96)
    expect(toDisplayPx(0.5)).toBe(48)
  })

  it('rounds to the nearest pixel', () => {
    expect(toDisplayPx(0.42)).toBe(40) // 40.32 rounds down
    expect(toDisplayPx(0.44)).toBe(42) // 42.24 rounds down
    expect(toDisplayPx(0.34)).toBe(33) // 32.64 rounds up
  })
})

describe('fromDisplayPx', () => {
  it('converts whole pixels back to inches', () => {
    expect(fromDisplayPx(96)).toBe(1)
    expect(fromDisplayPx(48)).toBe(0.5)
    expect(fromDisplayPx(0)).toBe(0)
  })

  it('round-trips a pixel value through toDisplayPx', () => {
    expect(toDisplayPx(fromDisplayPx(40))).toBe(40)
    expect(toDisplayPx(fromDisplayPx(384))).toBe(384)
  })
})
