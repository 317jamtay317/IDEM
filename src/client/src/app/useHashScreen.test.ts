import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  hashFromScreen,
  screenFromHash,
  templateIdFromHash,
  useHashScreen,
  type Screen,
} from './useHashScreen'

const ALL_SCREENS: Screen[] = [
  'home',
  'records',
  'reports',
  'orgs',
  'log',
  'facilities',
  'report-builder',
]

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
    ['#/facilities', 'facilities'],
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
    ['facilities', '#/facilities'],
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

describe('Report Builder route — screenFromHash & templateIdFromHash', () => {
  it('maps a builder hash with a template id to the report-builder screen', () => {
    expect(screenFromHash('#/report-builder/annual-emissions')).toBe('report-builder')
  })

  it('maps a builder hash without an id to the report-builder screen', () => {
    expect(screenFromHash('#/report-builder')).toBe('report-builder')
  })

  it('extracts the template id from a builder hash', () => {
    expect(templateIdFromHash('#/report-builder/annual-emissions')).toBe('annual-emissions')
  })

  it('decodes a percent-encoded template id', () => {
    expect(templateIdFromHash('#/report-builder/with%20space')).toBe('with space')
  })

  it('has no template id when the builder hash carries none', () => {
    expect(templateIdFromHash('#/report-builder')).toBeNull()
  })

  it('has no template id for a non-builder hash', () => {
    expect(templateIdFromHash('#/reports')).toBeNull()
    expect(templateIdFromHash('#/')).toBeNull()
  })
})

describe('Report Builder route — hashFromScreen', () => {
  it('encodes the template id into the builder hash', () => {
    expect(hashFromScreen('report-builder', 'annual-emissions')).toBe(
      '#/report-builder/annual-emissions',
    )
  })

  it('percent-encodes a template id with spaces', () => {
    expect(hashFromScreen('report-builder', 'with space')).toBe('#/report-builder/with%20space')
  })

  it('omits the trailing slash when no template id is given', () => {
    expect(hashFromScreen('report-builder')).toBe('#/report-builder')
  })

  it('round-trips a builder hash back to its screen and template id', () => {
    const hash = hashFromScreen('report-builder', 'annual-emissions')
    expect(screenFromHash(hash)).toBe('report-builder')
    expect(templateIdFromHash(hash)).toBe('annual-emissions')
  })
})

describe('useHashScreen — Report Builder template id', () => {
  it('exposes the template id named in the initial hash', () => {
    window.location.hash = '#/report-builder/annual-emissions'

    const { result } = renderHook(() => useHashScreen())

    expect(result.current[0]).toBe('report-builder')
    expect(result.current[2]).toBe('annual-emissions')
  })

  it('navigating to the builder writes the id into the hash and exposes it', () => {
    const { result } = renderHook(() => useHashScreen())

    act(() => {
      result.current[1]('report-builder', 'annual-emissions')
    })

    expect(result.current[0]).toBe('report-builder')
    expect(result.current[2]).toBe('annual-emissions')
    expect(window.location.hash).toBe('#/report-builder/annual-emissions')
  })

  it('clears the template id when navigating away from the builder', () => {
    window.location.hash = '#/report-builder/annual-emissions'
    const { result } = renderHook(() => useHashScreen())
    expect(result.current[2]).toBe('annual-emissions')

    act(() => {
      result.current[1]('reports')
    })

    expect(result.current[0]).toBe('reports')
    expect(result.current[2]).toBeNull()
  })
})
