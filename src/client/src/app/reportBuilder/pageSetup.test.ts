import { describe, it, expect } from 'vitest'
import {
  PAGE_SIZES,
  applyOrientation,
  applyPageSize,
  orientationOf,
  pageCount,
  pageSizeNameOf,
  type PageSizeName,
} from './pageSetup'
import { type PageSetup, createElement, createEmptyTemplate } from './model'

/** A US Letter portrait page with one-inch margins (the default). */
const letter: PageSetup = {
  width: 8.5,
  height: 11,
  margins: { top: 1, right: 1, bottom: 1, left: 1 },
}

describe('orientationOf', () => {
  it('reports portrait when the page is taller than it is wide', () => {
    expect(orientationOf(letter)).toBe('portrait')
  })

  it('reports landscape when the page is wider than it is tall', () => {
    expect(orientationOf({ ...letter, width: 11, height: 8.5 })).toBe('landscape')
  })

  it('treats a square page as portrait', () => {
    expect(orientationOf({ ...letter, width: 10, height: 10 })).toBe('portrait')
  })
})

describe('pageSizeNameOf', () => {
  it('recognises US Letter in portrait', () => {
    expect(pageSizeNameOf(letter)).toBe('letter')
  })

  it('recognises a named size regardless of orientation', () => {
    expect(pageSizeNameOf({ ...letter, width: 11, height: 8.5 })).toBe('letter')
  })

  it('recognises Legal and A4', () => {
    expect(pageSizeNameOf({ ...letter, width: 8.5, height: 14 })).toBe('legal')
    expect(pageSizeNameOf({ ...letter, width: 8.27, height: 11.69 })).toBe('a4')
  })

  it('reports a custom size when no named preset matches', () => {
    expect(pageSizeNameOf({ ...letter, width: 8, height: 10 })).toBe('custom')
  })
})

describe('applyPageSize', () => {
  it('sets the page to the named size in portrait', () => {
    const page = applyPageSize(letter, 'legal')

    expect(page.width).toBe(8.5)
    expect(page.height).toBe(14)
  })

  it('preserves the current orientation when changing size', () => {
    const landscapeLetter = applyOrientation(letter, 'landscape')

    const page = applyPageSize(landscapeLetter, 'a4')

    expect(orientationOf(page)).toBe('landscape')
    expect(page.width).toBeCloseTo(11.69, 2)
    expect(page.height).toBeCloseTo(8.27, 2)
  })

  it('keeps the margins unchanged', () => {
    expect(applyPageSize(letter, 'legal').margins).toEqual(letter.margins)
  })

  it('exposes the named sizes for the UI', () => {
    expect(PAGE_SIZES.map((s) => s.name)).toContain('letter')
    expect(PAGE_SIZES.map((s) => s.name)).toContain('a4')
  })

  it('returns the page unchanged for an unknown size name', () => {
    expect(applyPageSize(letter, 'tabloidx' as PageSizeName)).toBe(letter)
  })
})

describe('applyOrientation', () => {
  it('makes the page landscape by ordering width ≥ height', () => {
    const page = applyOrientation(letter, 'landscape')

    expect(page.width).toBe(11)
    expect(page.height).toBe(8.5)
  })

  it('makes the page portrait by ordering width ≤ height', () => {
    const landscape = applyOrientation(letter, 'landscape')

    const page = applyOrientation(landscape, 'portrait')

    expect(page.width).toBe(8.5)
    expect(page.height).toBe(11)
  })

  it('is a no-op when the page is already in the requested orientation', () => {
    expect(applyOrientation(letter, 'portrait')).toEqual(letter)
  })
})

describe('pageCount', () => {
  it('is one for a template with no page breaks', () => {
    expect(pageCount(createEmptyTemplate('t1', 'T1'))).toBe(1)
  })

  it('increases by one for each page-break element', () => {
    const t = createEmptyTemplate('t1', 'T1')
    t.bands[2].elements.push(createElement('pageBreak', 'pageBreak-1'))

    expect(pageCount(t)).toBe(2)
  })

  it('counts page breaks across every band', () => {
    const t = createEmptyTemplate('t1', 'T1')
    t.bands[0].elements.push(createElement('pageBreak', 'pageBreak-1'))
    t.bands[2].elements.push(createElement('pageBreak', 'pageBreak-2'))

    expect(pageCount(t)).toBe(3)
  })
})
