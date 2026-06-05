import { describe, it, expect } from 'vitest'
import { alignRects, distributeRects } from './align'
import { type Rect } from './model'

/**
 * Three rects with a deliberately clean bounding box so the expected aligned
 * positions are exact: minX 1, maxRight 5, minY 0, maxBottom 5 (centre 3, 2.5).
 */
const a: Rect = { x: 1, y: 1, w: 2, h: 1 } // right 3, bottom 2
const b: Rect = { x: 4, y: 3, w: 1, h: 2 } // right 5, bottom 5
const c: Rect = { x: 2, y: 0, w: 3, h: 0.5 } // right 5, bottom 0.5

describe('alignRects', () => {
  it('aligns every rect to the shared left edge (min X)', () => {
    expect(alignRects([a, b, c], 'left')).toEqual([
      { x: 1, y: 1, w: 2, h: 1 },
      { x: 1, y: 3, w: 1, h: 2 },
      { x: 1, y: 0, w: 3, h: 0.5 },
    ])
  })

  it('aligns every rect to the shared right edge (max right)', () => {
    expect(alignRects([a, b, c], 'right')).toEqual([
      { x: 3, y: 1, w: 2, h: 1 },
      { x: 4, y: 3, w: 1, h: 2 },
      { x: 2, y: 0, w: 3, h: 0.5 },
    ])
  })

  it('centres every rect on the shared horizontal mid-line', () => {
    expect(alignRects([a, b, c], 'center')).toEqual([
      { x: 2, y: 1, w: 2, h: 1 },
      { x: 2.5, y: 3, w: 1, h: 2 },
      { x: 1.5, y: 0, w: 3, h: 0.5 },
    ])
  })

  it('aligns every rect to the shared top edge (min Y)', () => {
    expect(alignRects([a, b, c], 'top')).toEqual([
      { x: 1, y: 0, w: 2, h: 1 },
      { x: 4, y: 0, w: 1, h: 2 },
      { x: 2, y: 0, w: 3, h: 0.5 },
    ])
  })

  it('aligns every rect to the shared bottom edge (max bottom)', () => {
    expect(alignRects([a, b, c], 'bottom')).toEqual([
      { x: 1, y: 4, w: 2, h: 1 },
      { x: 4, y: 3, w: 1, h: 2 },
      { x: 2, y: 4.5, w: 3, h: 0.5 },
    ])
  })

  it('centres every rect on the shared vertical mid-line', () => {
    expect(alignRects([a, b, c], 'middle')).toEqual([
      { x: 1, y: 2, w: 2, h: 1 },
      { x: 4, y: 1.5, w: 1, h: 2 },
      { x: 2, y: 2.25, w: 3, h: 0.5 },
    ])
  })

  it('does not mutate the input rects', () => {
    const input = [{ ...a }, { ...b }]
    alignRects(input, 'left')

    expect(input).toEqual([a, b])
  })

  it('leaves a single rect untouched (nothing to align to)', () => {
    expect(alignRects([a], 'right')).toEqual([a])
  })

  it('returns an empty list for an empty selection', () => {
    expect(alignRects([], 'left')).toEqual([])
  })
})

describe('distributeRects', () => {
  it('spaces three rects with equal horizontal gaps, keeping the extremes fixed', () => {
    const d1: Rect = { x: 0, y: 0, w: 1, h: 1 }
    const d2: Rect = { x: 2, y: 0, w: 1, h: 1 }
    const d3: Rect = { x: 9, y: 0, w: 1, h: 1 }

    // Span 0..10, total width 3, so 7 of free space split into two 3.5 gaps.
    expect(distributeRects([d1, d2, d3], 'horizontal')).toEqual([
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 4.5, y: 0, w: 1, h: 1 },
      { x: 9, y: 0, w: 1, h: 1 },
    ])
  })

  it('distributes by position regardless of input order, preserving input order out', () => {
    const d1: Rect = { x: 0, y: 0, w: 1, h: 1 }
    const d2: Rect = { x: 2, y: 0, w: 1, h: 1 }
    const d3: Rect = { x: 9, y: 0, w: 1, h: 1 }

    // Same three rects, shuffled: the result keeps input order but the positions
    // are computed from their sorted left edges.
    expect(distributeRects([d3, d1, d2], 'horizontal')).toEqual([
      { x: 9, y: 0, w: 1, h: 1 },
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 4.5, y: 0, w: 1, h: 1 },
    ])
  })

  it('spaces three rects with equal vertical gaps, keeping the extremes fixed', () => {
    const v1: Rect = { x: 0, y: 0, w: 1, h: 1 }
    const v2: Rect = { x: 0, y: 2, w: 1, h: 1 }
    const v3: Rect = { x: 0, y: 9, w: 1, h: 1 }

    expect(distributeRects([v1, v2, v3], 'vertical')).toEqual([
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0, y: 4.5, w: 1, h: 1 },
      { x: 0, y: 9, w: 1, h: 1 },
    ])
  })

  it('is a no-op for fewer than three rects (nothing in between to space)', () => {
    const two = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 5, y: 0, w: 1, h: 1 },
    ]

    expect(distributeRects(two, 'horizontal')).toEqual(two)
  })

  it('does not mutate the input rects', () => {
    const input = [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 2, y: 0, w: 1, h: 1 },
      { x: 9, y: 0, w: 1, h: 1 },
    ]
    const snapshot = input.map((r) => ({ ...r }))
    distributeRects(input, 'horizontal')

    expect(input).toEqual(snapshot)
  })
})
