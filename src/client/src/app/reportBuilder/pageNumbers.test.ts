import { describe, it, expect } from 'vitest'
import { DEFAULT_PAGE_NUMBER_OPTIONS } from './model'
import { PAGE_NUMBER_POSITIONS, formatPageNumber } from './pageNumbers'

describe('formatPageNumber', () => {
  it('substitutes the current page for {n} and the total for {N}', () => {
    expect(formatPageNumber(DEFAULT_PAGE_NUMBER_OPTIONS, 2, 5)).toBe('Page 2 of 5')
  })

  it('offsets both tokens by the start-at number', () => {
    // Starting at 5, the first of three pages reads "Page 5 of 7".
    expect(formatPageNumber({ ...DEFAULT_PAGE_NUMBER_OPTIONS, startAt: 5 }, 1, 3)).toBe('Page 5 of 7')
  })

  it('substitutes every occurrence of a token', () => {
    expect(
      formatPageNumber({ ...DEFAULT_PAGE_NUMBER_OPTIONS, format: '{n}/{N} — {n}' }, 2, 4),
    ).toBe('2/4 — 2')
  })

  it('leaves a format with no tokens unchanged', () => {
    expect(formatPageNumber({ ...DEFAULT_PAGE_NUMBER_OPTIONS, format: 'Confidential' }, 1, 2)).toBe(
      'Confidential',
    )
  })
})

describe('PAGE_NUMBER_POSITIONS', () => {
  it('offers left, center and right placements for the editor', () => {
    expect(PAGE_NUMBER_POSITIONS.map((p) => p.value)).toEqual(['left', 'center', 'right'])
  })
})
