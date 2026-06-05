import { describe, it, expect } from 'vitest'
import { bandAppearsOnPage, resolveElementText, rowContext } from './preview'
import { SAMPLE_DATA_CONTEXT } from './sampleData'
import { type ReportElement } from './model'

const ctx = SAMPLE_DATA_CONTEXT

/** Builds a report element with the given overrides over a default rect. */
function element(overrides: Partial<ReportElement> & Pick<ReportElement, 'id' | 'type'>): ReportElement {
  return { rect: { x: 0, y: 0, w: 1, h: 0.2 }, ...overrides }
}

describe('resolveElementText', () => {
  it('resolves a data-field expression against the context', () => {
    const el = element({ id: 'f', type: 'dataField', expression: '{Facility.Name}', text: '{Facility.Name}' })

    expect(resolveElementText(el, ctx)).toBe('Goshen Asphalt Plant')
  })

  it('resolves an aggregate formula over the detail rows', () => {
    const el = element({ id: 't', type: 'formula', expression: 'SUM({Record.Tons})' })

    expect(resolveElementText(el, ctx)).toBe('2240.75')
  })

  it('shows a static label as its own text', () => {
    expect(resolveElementText(element({ id: 'l', type: 'label', text: 'Hello' }), ctx)).toBe('Hello')
  })

  it('falls back to the display text when the expression cannot be evaluated', () => {
    const el = element({ id: 'b', type: 'dataField', expression: '{Bad.Field}', text: '{Bad.Field}' })

    expect(resolveElementText(el, ctx)).toBe('{Bad.Field}')
  })

  it('falls back to the raw expression when an unresolvable element has no display text', () => {
    const el = element({ id: 'b', type: 'formula', expression: 'SUM({Bad.Field})' })

    expect(resolveElementText(el, ctx)).toBe('SUM({Bad.Field})')
  })

  it('is empty for a textless shape', () => {
    expect(resolveElementText(element({ id: 's', type: 'rectangle' }), ctx)).toBe('')
  })
})

describe('rowContext', () => {
  it('scopes the detail to a single row so per-row fields resolve', () => {
    const el = element({ id: 'f', type: 'dataField', expression: '{Record.Field}' })

    expect(resolveElementText(el, rowContext(ctx, 1))).toBe('Cold Mix')
  })

  it('keeps the singular scopes and page context', () => {
    const r = rowContext(ctx, 0)

    expect(r.scopes).toBe(ctx.scopes)
    expect(r.page).toBe(ctx.page)
  })
})

describe('bandAppearsOnPage', () => {
  it('puts the report header on the first page only', () => {
    expect(bandAppearsOnPage('reportHeader', 0, 3)).toBe(true)
    expect(bandAppearsOnPage('reportHeader', 1, 3)).toBe(false)
  })

  it('repeats the page header and footer on every page', () => {
    expect(bandAppearsOnPage('pageHeader', 2, 3)).toBe(true)
    expect(bandAppearsOnPage('pageFooter', 1, 3)).toBe(true)
  })

  it('puts the detail band on the first page', () => {
    expect(bandAppearsOnPage('detail', 0, 3)).toBe(true)
    expect(bandAppearsOnPage('detail', 2, 3)).toBe(false)
  })

  it('puts the sub-report on the last page', () => {
    expect(bandAppearsOnPage('subReport', 2, 3)).toBe(true)
    expect(bandAppearsOnPage('subReport', 0, 3)).toBe(false)
  })
})
