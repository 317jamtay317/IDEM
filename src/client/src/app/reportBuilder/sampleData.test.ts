import { describe, it, expect } from 'vitest'
import { SAMPLE_DATA_CONTEXT, SAMPLE_FIELDS, createSampleDataContext } from './sampleData'
import { evaluateExpression, fieldPath, validateExpression } from './expressions'
import { createSampleTemplate } from './sampleTemplate'

describe('SAMPLE_FIELDS', () => {
  it('offers singular and detail fields across the report scopes', () => {
    const paths = SAMPLE_FIELDS.map(fieldPath)
    expect(paths).toContain('Facility.Name')
    expect(paths).toContain('Report.Year')
    expect(paths).toContain('Record.Tons')
  })

  it('marks Record fields as detail and singular scopes as not', () => {
    const tons = SAMPLE_FIELDS.find((f) => fieldPath(f) === 'Record.Tons')!
    const name = SAMPLE_FIELDS.find((f) => fieldPath(f) === 'Facility.Name')!
    expect(tons.isDetail).toBe(true)
    expect(name.isDetail).toBe(false)
  })
})

describe('createSampleDataContext', () => {
  it('resolves every advertised field to a value', () => {
    const ctx = createSampleDataContext()
    for (const f of SAMPLE_FIELDS) {
      expect(evaluateExpression(`{${fieldPath(f)}}`, ctx).ok, fieldPath(f)).toBe(true)
    }
  })

  it('has detail rows an aggregate can fold over', () => {
    const ctx = createSampleDataContext()
    expect(evaluateExpression('COUNT({Record.Tons})', ctx)).toEqual({ ok: true, value: '3' })
    expect(evaluateExpression('SUM({Record.Tons})', ctx).ok).toBe(true)
  })

  it('substitutes the page-number tokens from the sample page context', () => {
    expect(evaluateExpression('Page {n} of {N}', createSampleDataContext())).toEqual({
      ok: true,
      value: 'Page 1 of 3',
    })
  })

  it('builds an independent context equal to the shared constant', () => {
    expect(createSampleDataContext()).not.toBe(SAMPLE_DATA_CONTEXT)
    expect(createSampleDataContext()).toEqual(SAMPLE_DATA_CONTEXT)
  })
})

describe('the sample template expressions', () => {
  it('all validate against the sample fields', () => {
    const template = createSampleTemplate()
    const bound = template.bands.flatMap((b) => b.elements).filter((e) => e.expression !== undefined)
    expect(bound.length).toBeGreaterThan(0)
    for (const el of bound) {
      expect(validateExpression(el.expression!, SAMPLE_FIELDS), el.id).toEqual([])
    }
  })
})
