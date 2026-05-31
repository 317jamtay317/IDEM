import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordsScreen } from './RecordsScreen'

/**
 * Force a desktop viewport so the screen renders its data table. `useBreakpoint`
 * reads `window.matchMedia`, which jsdom does not implement; returning
 * `matches: true` for every query puts the screen in its desktop tier.
 */
function mockDesktop() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('RecordsScreen — desktop table', () => {
  beforeEach(() => {
    mockDesktop()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the records as a labelled data grid', () => {
    render(<RecordsScreen />)

    const grid = screen.getByRole('table', { name: 'Records' })
    expect(grid).toBeInTheDocument()
  })

  it('renders the records table through the reusable GridControl', () => {
    const { container } = render(<RecordsScreen />)

    // GridControl wraps its table in a `.grid-control` container.
    expect(container.querySelector('.grid-control')).toBeInTheDocument()
  })

  it('renders every expected column header', () => {
    render(<RecordsScreen />)

    const grid = screen.getByRole('table', { name: 'Records' })
    for (const header of ['Type', 'Facility', 'Operator', 'Value', 'Date', 'Status']) {
      expect(within(grid).getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
  })

  it('renders a row with its record data', () => {
    render(<RecordsScreen />)

    const grid = screen.getByRole('table', { name: 'Records' })
    expect(within(grid).getByText('Baghouse Pressure Log')).toBeInTheDocument()
    expect(within(grid).getByText('1,240 tons · 820 gal fuel')).toBeInTheDocument()
  })

  it('falls back to an em dash when a record has no operator', () => {
    render(<RecordsScreen />)

    // The Baghouse Pressure Log record (Fort Wayne) has a null operator.
    const grid = screen.getByRole('table', { name: 'Records' })
    expect(within(grid).getByText('—')).toBeInTheDocument()
  })

  it('renders a status pill label for each record', () => {
    render(<RecordsScreen />)

    const grid = screen.getByRole('table', { name: 'Records' })
    expect(within(grid).getByText('Overdue')).toBeInTheDocument()
    expect(within(grid).getByText('Draft')).toBeInTheDocument()
    expect(within(grid).getAllByText('Submitted').length).toBeGreaterThan(0)
  })

  it('stays read-only and unpaged, matching the design', () => {
    render(<RecordsScreen />)

    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('filters rows by the selected category chip', async () => {
    const user = userEvent.setup()
    render(<RecordsScreen />)

    await user.click(screen.getByRole('tab', { name: 'Baghouse' }))

    const grid = screen.getByRole('table', { name: 'Records' })
    expect(within(grid).getByText('Baghouse Pressure Log')).toBeInTheDocument()
    expect(within(grid).queryByText('Daily Production Log')).not.toBeInTheDocument()
  })
})
