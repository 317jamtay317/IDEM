import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { hashFromScreen, screenFromHash, useHashScreen, type Screen } from './useHashScreen'

const ALL_SCREENS: Screen[] = ['home', 'records', 'reports', 'orgs', 'log']

afterEach(() => {
  // Each test owns the location hash; reset it so state never leaks between tests.
  window.location.hash = ''
})

describe('screenFromHash', () => {
  it('treats an empty hash as the home screen', () => {
    expect(screenFromHash('')).toBe('home')
  })

  it('treats the bare and root hashes as the home screen', () => {
    expect(screenFromHash('#')).toBe('home')
    expect(screenFromHash('#/')).toBe('home')
  })

  it.each([
    ['#/records', 'records'],
    ['#/reports', 'reports'],
    ['#/orgs', 'orgs'],
    ['#/log', 'log'],
  ])('maps %s to the %s screen', (hash, expected) => {
    expect(screenFromHash(hash)).toBe(expected)
  })

  it('falls back to the home screen for an unknown destination', () => {
    expect(screenFromHash('#/does-not-exist')).toBe('home')
  })

  it('falls back to home for the retired More destination', () => {
    expect(screenFromHash('#/more')).toBe('home')
  })
})

describe('hashFromScreen', () => {
  it('maps the home screen to the root hash', () => {
    expect(hashFromScreen('home')).toBe('#/')
  })

  it.each([
    ['records', '#/records'],
    ['reports', '#/reports'],
    ['orgs', '#/orgs'],
    ['log', '#/log'],
  ] as const)('maps the %s screen to %s', (screen, expected) => {
    expect(hashFromScreen(screen)).toBe(expected)
  })

  it('round-trips every screen back to itself', () => {
    for (const s of ALL_SCREENS) {
      expect(screenFromHash(hashFromScreen(s))).toBe(s)
    }
  })
})

describe('useHashScreen', () => {
  it('derives the initial screen from the current location hash', () => {
    window.location.hash = '#/reports'

    const { result } = renderHook(() => useHashScreen())

    expect(result.current[0]).toBe('reports')
  })

  it('defaults to the home screen when there is no hash', () => {
    window.location.hash = ''

    const { result } = renderHook(() => useHashScreen())

    expect(result.current[0]).toBe('home')
  })

  it('navigating updates both the active screen and the URL hash', () => {
    const { result } = renderHook(() => useHashScreen())

    act(() => {
      result.current[1]('records')
    })

    expect(result.current[0]).toBe('records')
    expect(window.location.hash).toBe('#/records')
  })

  it('returns home to the root hash so the URL stays clean', () => {
    window.location.hash = '#/records'
    const { result } = renderHook(() => useHashScreen())

    act(() => {
      result.current[1]('home')
    })

    expect(result.current[0]).toBe('home')
    expect(window.location.hash).toBe('#/')
  })

  it('navigating to the already-active screen is a no-op on the hash', () => {
    window.location.hash = '#/records'
    const { result } = renderHook(() => useHashScreen())

    act(() => {
      result.current[1]('records')
    })

    expect(result.current[0]).toBe('records')
    expect(window.location.hash).toBe('#/records')
  })

  it('reacts to external hash changes, e.g. the browser back button', () => {
    window.location.hash = '#/records'
    const { result } = renderHook(() => useHashScreen())
    expect(result.current[0]).toBe('records')

    act(() => {
      window.location.hash = '#/reports'
      window.dispatchEvent(new Event('hashchange'))
    })

    expect(result.current[0]).toBe('reports')
  })
})
