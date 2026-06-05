import { describe, it, expect } from 'vitest'
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  initHistory,
  record,
  redo,
  undo,
} from './history'

describe('history', () => {
  it('starts with no past and no future', () => {
    const h = initHistory('a')

    expect(h.present).toBe('a')
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
  })

  it('records a new present, making undo available', () => {
    const h = record(initHistory('a'), 'b')

    expect(h.present).toBe('b')
    expect(canUndo(h)).toBe(true)
  })

  it('undo restores the previous present and offers redo', () => {
    const h = undo(record(initHistory('a'), 'b'))

    expect(h.present).toBe('a')
    expect(canRedo(h)).toBe(true)
  })

  it('redo re-applies an undone change', () => {
    expect(redo(undo(record(initHistory('a'), 'b'))).present).toBe('b')
  })

  it('undo at the start is a no-op (same reference)', () => {
    const h = initHistory('a')

    expect(undo(h)).toBe(h)
  })

  it('redo at the end is a no-op (same reference)', () => {
    const h = record(initHistory('a'), 'b')

    expect(redo(h)).toBe(h)
  })

  it('clears the redo future when a new change is recorded after an undo', () => {
    let h = record(initHistory('a'), 'b')
    h = undo(h) // back to 'a', future holds 'b'
    h = record(h, 'c')

    expect(h.present).toBe('c')
    expect(canRedo(h)).toBe(false)
  })

  it('coalesces consecutive changes that share a tag into one undo step', () => {
    let h = record(initHistory('a'), 'b', 'move') // pushes 'a' onto the past
    h = record(h, 'c', 'move') // coalesces: replaces the present, no new past entry

    expect(h.present).toBe('c')

    h = undo(h)
    expect(h.present).toBe('a') // one undo restores the pre-gesture state
    expect(canUndo(h)).toBe(false)
  })

  it('does not coalesce changes with different tags', () => {
    let h = record(initHistory('a'), 'b', 'move')
    h = record(h, 'c', 'resize')

    expect(undo(h).present).toBe('b') // the resize alone is undone
  })

  it('does not coalesce untagged changes', () => {
    let h = record(initHistory('a'), 'b')
    h = record(h, 'c')

    expect(undo(h).present).toBe('b')
  })

  it('starts a fresh undo step for a tagged change after an undo', () => {
    let h = record(initHistory('a'), 'b', 'move') // past: [a]
    h = undo(h) // back to 'a', coalesce tag reset
    h = record(h, 'c', 'move') // must push (not coalesce into the restored state)
    h = record(h, 'd', 'move') // coalesces with the previous 'move'

    expect(undo(h).present).toBe('a')
  })

  it('caps the past at HISTORY_LIMIT, dropping the oldest entries', () => {
    let h = initHistory(0)
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) h = record(h, i)

    let steps = 0
    while (canUndo(h)) {
      h = undo(h)
      steps++
    }

    expect(steps).toBe(HISTORY_LIMIT)
  })
})
