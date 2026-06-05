import { describe, it, expect } from 'vitest'
import { alignmentGuides } from './guides'
import { type Rect } from './model'

/** A moving rect with clean lines: left 2, centre-x 3, right 4; top 2, middle 2.5, bottom 3. */
const moving: Rect = { x: 2, y: 2, w: 2, h: 1 }

describe('alignmentGuides', () => {
  it('shows a vertical guide when a left edge lines up within tolerance', () => {
    const other: Rect = { x: 2, y: 6, w: 1, h: 1 } // left 2 matches the moving left 2

    expect(alignmentGuides(moving, [other], 0.05)).toContainEqual({ orientation: 'vertical', position: 2 })
  })

  it('shows a horizontal guide when a top edge lines up within tolerance', () => {
    const other: Rect = { x: 8, y: 2, w: 1, h: 1 } // top 2 matches the moving top 2

    expect(alignmentGuides(moving, [other], 0.05)).toContainEqual({ orientation: 'horizontal', position: 2 })
  })

  it('matches centre lines, not only outer edges', () => {
    const other: Rect = { x: 2.5, y: 6, w: 1, h: 1 } // centre-x 3 matches the moving centre-x 3

    expect(alignmentGuides(moving, [other], 0.05)).toContainEqual({ orientation: 'vertical', position: 3 })
  })

  it('places the guide on the other element line when within tolerance but not exact', () => {
    const other: Rect = { x: 2.03, y: 6, w: 1, h: 1 } // left 2.03 within 0.05 of the moving left 2

    expect(alignmentGuides(moving, [other], 0.05)).toContainEqual({ orientation: 'vertical', position: 2.03 })
  })

  it('shows no guide when every line is beyond tolerance', () => {
    const other: Rect = { x: 9, y: 9, w: 1, h: 1 }

    expect(alignmentGuides(moving, [other], 0.05)).toEqual([])
  })

  it('does not duplicate a guide that several elements share', () => {
    const o1: Rect = { x: 2, y: 6, w: 1, h: 1 }
    const o2: Rect = { x: 2, y: 8, w: 1, h: 1 }

    const guides = alignmentGuides(moving, [o1, o2], 0.05)

    expect(guides.filter((g) => g.orientation === 'vertical' && g.position === 2)).toHaveLength(1)
  })
})
