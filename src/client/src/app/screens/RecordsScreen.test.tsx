import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { RecordsScreen } from './RecordsScreen'

/**
 * Stub `window.matchMedia` so `useBreakpoint` resolves to a chosen tier. jsdom
 * does not implement matchMedia; `matches` is returned for every query.
 */
function stubBreakpoint(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RecordsScreen — desktop facility summary table', () => {
  beforeEach(() => {
    stubBreakpoint(true)
  })

  it('renders the facility summaries as a labelled data grid', () => {
    const { container } = render(<RecordsScreen />)

    expect(screen.getByRole('table', { name: 'Records' })).toBeInTheDocument()
    // Rendered through the reusable GridControl (its wrapper class).
    expect(container.querySelector('.grid-control')).toBeInTheDocument()
  })

  it('renders the facility-summary column headers from the design', () => {
    render(<RecordsScreen />)

    const grid = screen.getByRole('table', { name: 'Records' })
    for (const header of [
      'Facility',
      'Last ran',
      'Last record',
      'Monthly due',
      'Quarterly due',
      'Status',
    ]) {
      expect(within(grid).getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
  })

  it('renders a facility row with its summary data', () => {
    render(<RecordsScreen />)

    const grid = screen.getByRole('table', { name: 'Records' })
    expect(within(grid).getByText('Goshen Asphalt Plant')).toBeInTheDocument()
    expect(within(grid).getByText('Jun 15, 2026')).toBeInTheDocument()
  })

  it('renders a status pill for each facility', () => {
    render(<RecordsScreen />)

    const grid = screen.getByRole('table', { name: 'Records' })
    expect(within(grid).getByText('On track')).toBeInTheDocument()
    expect(within(grid).getByText('Overdue')).toBeInTheDocument()
    expect(within(grid).getByText('Due soon')).toBeInTheDocument()
  })

  it('emphasises the monthly due date by urgency', () => {
    render(<RecordsScreen />)

    // Overdue → danger tone; due-soon → warning tone.
    expect(screen.getByText('May 15, 2026').className).toContain('text-danger')
    expect(screen.getByText('Jun 1, 2026').className).toContain('text-warning')
  })

  it('shows the facility count in the subtitle', () => {
    render(<RecordsScreen />)

    expect(screen.getByText('Active facilities · 3 plants')).toBeInTheDocument()
  })

  it('is read-only and unpaged, matching the design', () => {
    render(<RecordsScreen />)

    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('drops the old category filter chips', () => {
    render(<RecordsScreen />)

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Production' })).not.toBeInTheDocument()
  })
})

describe('RecordsScreen — mobile facility cards', () => {
  beforeEach(() => {
    stubBreakpoint(false)
  })

  it('renders facility cards instead of a table', () => {
    render(<RecordsScreen />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Goshen Asphalt Plant')).toBeInTheDocument()
  })

  it('shows the region line and field labels on each card', () => {
    render(<RecordsScreen />)

    expect(screen.getAllByText('Indiana · IDEM')).toHaveLength(3)
    expect(screen.getAllByText('Last ran').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Quarterly due').length).toBeGreaterThan(0)
  })

  it('renders a status pill on each facility card', () => {
    render(<RecordsScreen />)

    expect(screen.getByText('On track')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Due soon')).toBeInTheDocument()
  })
})
