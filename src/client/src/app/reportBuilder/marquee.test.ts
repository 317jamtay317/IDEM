import { describe, it, expect } from 'vitest'
import { marqueeRect, rectsIntersect, marqueeSelect } from './marquee'
import { type Rect } from './model'

describe('marqueeRect', () => {
  it('builds a rect from two corner points dragged down-right', () => {
    expect(marqueeRect({ x: 1, y: 2 }, { x: 4, y: 6 })).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })

  it('normalizes a drag up-left into a positive-size rect', () => {
    expect(marqueeRect({ x: 4, y: 6 }, { x: 1, y: 2 })).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })

  it('normalizes a drag down-left or up-right into the same rect', () => {
    expect(marqueeRect({ x: 4, y: 2 }, { x: 1, y: 6 })).toEqual({ x: 1, y: 2, w: 3, h: 4 })
    expect(marqueeRect({ x: 1, y: 6 }, { x: 4, y: 2 })).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  })

  it('is a zero-size rect when the two points coincide', () => {
    expect(marqueeRect({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual({ x: 3, y: 3, w: 0, h: 0 })
  })
})

describe('rectsIntersect', () => {
  const a: Rect = { x: 0, y: 0, w: 2, h: 2 }

  it('is true when two rects overlap', () => {
    expect(rectsIntersect(a, { x: 1, y: 1, w: 2, h: 2 })).toBe(true)
  })

  it('is true when one rect contains the other', () => {
    expect(rectsIntersect(a, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 })).toBe(true)
  })

  it('is false when two rects are disjoint', () => {
    expect(rectsIntersect(a, { x: 3, y: 0, w: 1, h: 1 })).toBe(false)
  })

  it('is false when two rects only touch at an edge (no shared area)', () => {
    expect(rectsIntersect(a, { x: 2, y: 0, w: 1, h: 1 })).toBe(false)
  })
})

describe('marqueeSelect', () => {
  const items = [
    { id: 'a', rect: { x: 0, y: 0, w: 1, h: 1 } },
    { id: 'b', rect: { x: 2, y: 2, w: 1, h: 1 } },
    { id: 'c', rect: { x: 5, y: 5, w: 1, h: 1 } },
  ]

  it('returns the ids of the items the marquee intersects', () => {
    expect(marqueeSelect({ x: 0, y: 0, w: 3, h: 3 }, items)).toEqual(['a', 'b'])
  })

  it('returns an empty array when the marquee intersects nothing', () => {
    expect(marqueeSelect({ x: 10, y: 10, w: 1, h: 1 }, items)).toEqual([])
  })

  it('preserves the input order of the items', () => {
    expect(marqueeSelect({ x: 0, y: 0, w: 10, h: 10 }, items)).toEqual(['a', 'b', 'c'])
  })
})
