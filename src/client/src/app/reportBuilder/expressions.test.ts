import { describe, it, expect } from 'vitest'
import {
  EXPRESSION_FUNCTIONS,
  evaluateExpression,
  fieldPath,
  parseExpression,
  validateExpression,
  type DataContext,
  type DataFieldDef,
} from './expressions'

describe('parseExpression', () => {
  it('treats plain text as a single literal segment', () => {
    expect(parseExpression('Annual Emissions Inventory')).toEqual([
      { kind: 'text', value: 'Annual Emissions Inventory' },
    ])
  })

  it('parses a field reference into its scope and field', () => {
    expect(parseExpression('{Facility.Name}')).toEqual([
      { kind: 'field', scope: 'Facility', field: 'Name' },
    ])
  })

  it('parses the page-number tokens {n} and {N}', () => {
    expect(parseExpression('Page {n} of {N}')).toEqual([
      { kind: 'text', value: 'Page ' },
      { kind: 'page', token: 'n' },
      { kind: 'text', value: ' of ' },
      { kind: 'page', token: 'N' },
    ])
  })

  it('parses an aggregate function over a field, upper-casing the name', () => {
    expect(parseExpression('Sum({Record.Tons})')).toEqual([
      { kind: 'function', name: 'SUM', scope: 'Record', field: 'Tons' },
    ])
  })

  it('parses literal text interleaved with field references', () => {
    expect(parseExpression('{Facility.Name} — Calendar Year {Report.Year}')).toEqual([
      { kind: 'field', scope: 'Facility', field: 'Name' },
      { kind: 'text', value: ' — Calendar Year ' },
      { kind: 'field', scope: 'Report', field: 'Year' },
    ])
  })

  it('flags a malformed token (empty or without a scope.field shape) as invalid', () => {
    expect(parseExpression('{}')).toEqual([{ kind: 'invalid', raw: '{}' }])
    expect(parseExpression('{Bogus}')).toEqual([{ kind: 'invalid', raw: '{Bogus}' }])
  })

  it('returns no segments for an empty string', () => {
    expect(parseExpression('')).toEqual([])
  })
})

describe('fieldPath', () => {
  it('joins a scope and field with a dot', () => {
    expect(fieldPath({ scope: 'Record', field: 'Tons' })).toBe('Record.Tons')
  })
})

describe('EXPRESSION_FUNCTIONS', () => {
  it('offers the aggregate functions', () => {
    expect(EXPRESSION_FUNCTIONS).toEqual(['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'])
  })
})

const fields: DataFieldDef[] = [
  { scope: 'Facility', field: 'Name', label: 'Name', isDetail: false },
  { scope: 'Report', field: 'Year', label: 'Year', isDetail: false },
  { scope: 'Record', field: 'Tons', label: 'Tons', isDetail: true },
  { scope: 'Record', field: 'Field', label: 'Field', isDetail: true },
]

const context: DataContext = {
  scopes: {
    Facility: { Name: 'Goshen Asphalt Plant' },
    Report: { Year: '2025' },
  },
  detailScope: 'Record',
  detail: [
    { Field: 'Hot Mix', Tons: 12.5 },
    { Field: 'Cold Mix', Tons: 4.25 },
    { Field: 'Steel Slag', Tons: 7 },
  ],
  page: { number: 1, total: 3 },
}

describe('evaluateExpression', () => {
  it('returns literal text unchanged', () => {
    expect(evaluateExpression('Hello', context)).toEqual({ ok: true, value: 'Hello' })
  })

  it('resolves a singular field reference from its scope', () => {
    expect(evaluateExpression('{Facility.Name}', context)).toEqual({
      ok: true,
      value: 'Goshen Asphalt Plant',
    })
  })

  it('resolves a detail field against the first detail row', () => {
    expect(evaluateExpression('{Record.Field}', context)).toEqual({ ok: true, value: 'Hot Mix' })
  })

  it('substitutes the page-number tokens', () => {
    expect(evaluateExpression('Page {n} of {N}', context)).toEqual({ ok: true, value: 'Page 1 of 3' })
  })

  it('sums a detail field across every detail row', () => {
    expect(evaluateExpression('SUM({Record.Tons})', context)).toEqual({ ok: true, value: '23.75' })
  })

  it('averages, counts, and takes the min/max of a detail field', () => {
    expect(evaluateExpression('AVG({Record.Tons})', context)).toEqual({ ok: true, value: '7.92' })
    expect(evaluateExpression('COUNT({Record.Tons})', context)).toEqual({ ok: true, value: '3' })
    expect(evaluateExpression('MIN({Record.Tons})', context)).toEqual({ ok: true, value: '4.25' })
    expect(evaluateExpression('MAX({Record.Tons})', context)).toEqual({ ok: true, value: '12.5' })
  })

  it('concatenates several segments into one string', () => {
    expect(evaluateExpression('{Facility.Name} — Year {Report.Year}', context)).toEqual({
      ok: true,
      value: 'Goshen Asphalt Plant — Year 2025',
    })
  })

  it('errors when a field references an unknown scope or field', () => {
    expect(evaluateExpression('{Facility.Phone}', context)).toEqual({
      ok: false,
      error: 'Unknown field: Facility.Phone',
    })
    expect(evaluateExpression('{Widget.Size}', context)).toEqual({
      ok: false,
      error: 'Unknown field: Widget.Size',
    })
  })

  it('errors when an aggregate is applied to a non-detail field', () => {
    expect(evaluateExpression('SUM({Facility.Name})', context)).toEqual({
      ok: false,
      error: 'SUM() requires a detail field',
    })
  })

  it('errors when an aggregate names a field absent from the detail rows', () => {
    expect(evaluateExpression('SUM({Record.Missing})', context)).toEqual({
      ok: false,
      error: 'Unknown field: Record.Missing',
    })
  })

  it('errors on an unknown function', () => {
    expect(evaluateExpression('TOTAL({Record.Tons})', context)).toEqual({
      ok: false,
      error: 'Unknown function: TOTAL',
    })
  })

  it('errors on a malformed token', () => {
    expect(evaluateExpression('{Bogus}', context)).toEqual({
      ok: false,
      error: 'Invalid expression: {Bogus}',
    })
  })
})

describe('validateExpression', () => {
  it('reports no errors for a valid expression', () => {
    expect(validateExpression('{Facility.Name} {Report.Year}', fields)).toEqual([])
    expect(validateExpression('Page {n} of {N}', fields)).toEqual([])
    expect(validateExpression('SUM({Record.Tons})', fields)).toEqual([])
    expect(validateExpression('Just text', fields)).toEqual([])
  })

  it('flags an unknown field reference', () => {
    expect(validateExpression('{Facility.Phone}', fields)).toEqual([
      { message: 'Unknown field: Facility.Phone' },
    ])
  })

  it('flags an unknown function', () => {
    expect(validateExpression('TOTAL({Record.Tons})', fields)).toEqual([
      { message: 'Unknown function: TOTAL' },
    ])
  })

  it('flags an aggregate over a non-detail field', () => {
    expect(validateExpression('SUM({Facility.Name})', fields)).toEqual([
      { message: 'SUM() requires a detail field' },
    ])
  })

  it('flags an aggregate over a field absent from the catalog', () => {
    expect(validateExpression('SUM({Record.Missing})', fields)).toEqual([
      { message: 'Unknown field: Record.Missing' },
    ])
  })

  it('flags a malformed token', () => {
    expect(validateExpression('{Bogus}', fields)).toEqual([
      { message: 'Invalid field reference: {Bogus}' },
    ])
  })

  it('collects multiple errors across the expression', () => {
    expect(validateExpression('{Facility.Phone} and {Widget.Size}', fields)).toEqual([
      { message: 'Unknown field: Facility.Phone' },
      { message: 'Unknown field: Widget.Size' },
    ])
  })
})
