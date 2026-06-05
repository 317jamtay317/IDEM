import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ZOOM,
  PX_PER_INCH,
  ZOOM_LEVELS,
  bandTops,
  draggedPosition,
  inchesToPx,
  pointsToPx,
  pxToInches,
  resizedRect,
  snap,
  zoomIn,
  zoomOut,
} from './geometry'

describe('inchesToPx', () => {
  it('maps inches to CSS pixels at the reference resolution when zoomed to 100%', () => {
    expect(inchesToPx(1, 100)).toBe(PX_PER_INCH)
    expect(inchesToPx(8.5, 100)).toBe(8.5 * PX_PER_INCH)
  })

  it('scales the pixel size with the zoom level', () => {
    expect(inchesToPx(1, 200)).toBe(PX_PER_INCH * 2)
    expect(inchesToPx(1, 50)).toBe(PX_PER_INCH / 2)
  })

  it('maps zero inches to zero pixels at any zoom', () => {
    expect(inchesToPx(0, 150)).toBe(0)
  })
})

describe('pointsToPx', () => {
  it('converts points to pixels at the reference resolution and zoom', () => {
    expect(pointsToPx(72, 100)).toBe(96) // 72pt = 1in = 96px
    expect(pointsToPx(12, 100)).toBe(16)
    expect(pointsToPx(12, 200)).toBe(32)
  })
})

describe('pxToInches', () => {
  it('inverts inchesToPx at 100% zoom', () => {
    expect(pxToInches(96, 100)).toBe(1)
    expect(pxToInches(48, 100)).toBe(0.5)
  })

  it('accounts for the zoom level', () => {
    expect(pxToInches(192, 200)).toBe(1) // 192px at 200% is 1in on the page
    expect(pxToInches(48, 50)).toBe(1) // 48px at 50% is 1in on the page
  })

  it('round-trips a value through inchesToPx', () => {
    expect(pxToInches(inchesToPx(0.42, 125), 125)).toBeCloseTo(0.42, 10)
  })
})

describe('draggedPosition', () => {
  it('offsets the start position by a pixel delta converted to inches', () => {
    expect(draggedPosition({ x: 1, y: 1 }, { x: 96, y: 48 }, 100)).toEqual({ x: 2, y: 1.5 })
  })

  it('scales the delta by the zoom level', () => {
    expect(draggedPosition({ x: 1, y: 0 }, { x: 192, y: 0 }, 200)).toEqual({ x: 2, y: 0 })
  })

  it('clamps the position to the band/page origin (never negative)', () => {
    expect(draggedPosition({ x: 0.5, y: 0.5 }, { x: -96, y: -96 }, 100)).toEqual({ x: 0, y: 0 })
  })

  it('snaps the dragged position to the grid when snapping is enabled', () => {
    // start (1,1) + 30px @100% = +0.3125in → (1.3125, 1.3125), snapped to 0.125in → (1.375, 1.375).
    expect(draggedPosition({ x: 1, y: 1 }, { x: 30, y: 30 }, 100, 0.125, true)).toEqual({ x: 1.375, y: 1.375 })
  })

  it('does not snap when snapping is disabled (the default)', () => {
    expect(draggedPosition({ x: 1, y: 1 }, { x: 30, y: 30 }, 100)).toEqual({ x: 1.3125, y: 1.3125 })
  })
})

describe('snap', () => {
  it('rounds a value to the nearest multiple of the grid when enabled', () => {
    expect(snap(1.2, 0.125, true)).toBe(1.25)
    expect(snap(1.18, 0.125, true)).toBe(1.125)
  })

  it('leaves a value already on the grid exactly where it is', () => {
    expect(snap(0.5, 0.125, true)).toBe(0.5)
  })

  it('rounds a half-cell up to the next grid line', () => {
    expect(snap(0.0625, 0.125, true)).toBe(0.125)
  })

  it('returns the value unchanged when snapping is disabled', () => {
    expect(snap(1.2, 0.125, false)).toBe(1.2)
  })

  it('returns the value unchanged when the grid is zero or negative', () => {
    expect(snap(1.2, 0, true)).toBe(1.2)
    expect(snap(1.2, -0.125, true)).toBe(1.2)
  })
})

describe('resizedRect', () => {
  const start = { x: 1, y: 1, w: 2, h: 1 } // left 1, top 1, right 3, bottom 2

  it('grows width and height from the bottom-right handle', () => {
    expect(resizedRect(start, 'se', { x: 1, y: 0.5 })).toEqual({ x: 1, y: 1, w: 3, h: 1.5 })
  })

  it('moves the left and top edges from the top-left handle', () => {
    expect(resizedRect(start, 'nw', { x: 0.5, y: 0.25 })).toEqual({ x: 1.5, y: 1.25, w: 1.5, h: 0.75 })
  })

  it('moves the left edge and bottom edge from the bottom-left handle', () => {
    expect(resizedRect(start, 'sw', { x: 0.5, y: 0.5 })).toEqual({ x: 1.5, y: 1, w: 1.5, h: 1.5 })
  })

  it('moves the right edge and top edge from the top-right handle', () => {
    expect(resizedRect(start, 'ne', { x: 1, y: 0.5 })).toEqual({ x: 1, y: 1.5, w: 3, h: 0.5 })
  })

  it('collapses to zero rather than inverting when over-dragged', () => {
    expect(resizedRect(start, 'se', { x: -5, y: -5 })).toEqual({ x: 1, y: 1, w: 0, h: 0 })
  })

  it('keeps a moved edge on the page (origin never negative)', () => {
    expect(resizedRect(start, 'nw', { x: -5, y: -5 })).toEqual({ x: 0, y: 0, w: 3, h: 2 })
  })

  it('snaps the dragged edges to the grid when snapping is enabled (SE handle)', () => {
    // se moves right & bottom: right 3 + 0.3125 = 3.3125 → 3.375; bottom 2 + 0.3125 = 2.3125 → 2.375.
    expect(resizedRect(start, 'se', { x: 0.3125, y: 0.3125 }, 0.125, true)).toEqual({ x: 1, y: 1, w: 2.375, h: 1.375 })
  })

  it('snaps the dragged edges to the grid when snapping is enabled (NW handle)', () => {
    // nw moves left & top: left 1 + 0.1875 = 1.1875 → 1.25; top 1 + 0.1875 = 1.1875 → 1.25.
    expect(resizedRect(start, 'nw', { x: 0.1875, y: 0.1875 }, 0.125, true)).toEqual({ x: 1.25, y: 1.25, w: 1.75, h: 0.75 })
  })

  it('does not snap when snapping is disabled (the default)', () => {
    expect(resizedRect(start, 'se', { x: 0.3125, y: 0.3125 })).toEqual({ x: 1, y: 1, w: 2.3125, h: 1.3125 })
  })
})

describe('zoom levels', () => {
  it('defaults to 100% and includes it among the selectable levels', () => {
    expect(DEFAULT_ZOOM).toBe(100)
    expect(ZOOM_LEVELS).toContain(100)
  })

  it('lists the levels in ascending order', () => {
    expect([...ZOOM_LEVELS]).toEqual([...ZOOM_LEVELS].sort((a, b) => a - b))
  })
})

describe('zoomIn', () => {
  it('steps up to the next selectable level', () => {
    expect(zoomIn(100)).toBe(125)
    expect(zoomIn(50)).toBe(75)
  })

  it('clamps at the maximum level', () => {
    const max = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
    expect(zoomIn(max)).toBe(max)
  })
})

describe('zoomOut', () => {
  it('steps down to the previous selectable level', () => {
    expect(zoomOut(100)).toBe(75)
    expect(zoomOut(200)).toBe(150)
  })

  it('clamps at the minimum level', () => {
    const min = ZOOM_LEVELS[0]
    expect(zoomOut(min)).toBe(min)
  })
})

describe('bandTops', () => {
  it('returns the cumulative top offset of each band, in order', () => {
    expect(bandTops([{ height: 1.5 }, { height: 0.35 }, { height: 0.3 }])).toEqual([0, 1.5, 1.85])
  })

  it('starts the first band at zero', () => {
    expect(bandTops([{ height: 2 }])).toEqual([0])
  })

  it('returns an empty array when there are no bands', () => {
    expect(bandTops([])).toEqual([])
  })
})
