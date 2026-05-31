import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('RecordsScreen — production drill-down', () => {
  const PRODUCTION_HEADERS = [
    'Date',
    'Hot Mix',
    'Cold Mix',
    'Plant Ran',
    'Steel Slag',
    'Blast Furnace',
  ]

  it('opens the production grid when a facility name is clicked (desktop)', async () => {
    stubBreakpoint(true)
    const user = userEvent.setup()
    render(<RecordsScreen />)

    await user.click(screen.getByRole('button', { name: 'Goshen Asphalt Plant' }))

    // The facility list is gone; the drill-down grid is shown.
    expect(screen.queryByText('Active facilities')).not.toBeInTheDocument()
    const grid = screen.getByRole('table')
    for (const header of PRODUCTION_HEADERS) {
      expect(within(grid).getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
  })

  it('renders the production columns in the requested order', async () => {
    stubBreakpoint(true)
    const user = userEvent.setup()
    render(<RecordsScreen />)

    await user.click(screen.getByRole('button', { name: 'Goshen Asphalt Plant' }))

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(PRODUCTION_HEADERS)
  })

  it('pages the last 10 days, 5 per page', async () => {
    stubBreakpoint(true)
    const user = userEvent.setup()
    render(<RecordsScreen />)

    await user.click(screen.getByRole('button', { name: 'Goshen Asphalt Plant' }))

    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument()
    // First page = the 5 newest days.
    expect(within(screen.getByRole('table')).getByText('May 31')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByText('May 26')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('May 26')).toBeInTheDocument()
  })

  it('renders the Plant Ran column as hours, with idle days showing 0 h', async () => {
    stubBreakpoint(true)
    const user = userEvent.setup()
    render(<RecordsScreen />)

    await user.click(screen.getByRole('button', { name: 'Goshen Asphalt Plant' }))

    const grid = screen.getByRole('table')
    // Goshen's first page runs 8 / 8.5 / 9 / 9.5 hours, then one idle day at 0 h.
    expect(within(grid).getByText('8.5 h')).toBeInTheDocument()
    expect(within(grid).getByText('0 h')).toBeInTheDocument()
  })

  it('returns to the facility list when Back is clicked', async () => {
    stubBreakpoint(true)
    const user = userEvent.setup()
    render(<RecordsScreen />)

    await user.click(screen.getByRole('button', { name: 'Goshen Asphalt Plant' }))
    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.getByText('Active facilities')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Records' })).toBeInTheDocument()
  })

  it('opens the drill-down from a facility card (mobile)', async () => {
    stubBreakpoint(false)
    const user = userEvent.setup()
    render(<RecordsScreen />)

    await user.click(screen.getByRole('button', { name: /Goshen Asphalt Plant/ }))

    const grid = screen.getByRole('table')
    expect(within(grid).getByRole('columnheader', { name: 'Hot Mix' })).toBeInTheDocument()
  })
})
