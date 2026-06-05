import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatePicker } from './DatePicker'

afterEach(() => vi.clearAllMocks())

/** Render a controlled DatePicker seeded on 2026-06-04 and return its handles. */
function setup(value = '2026-06-04') {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<DatePicker value={value} onChange={onChange} ariaLabel="Permit expiration date" />)
  const trigger = screen.getByRole('button', { name: /permit expiration date/i })
  return { onChange, user, trigger }
}

describe('DatePicker', () => {
  it('shows a placeholder when no date is selected', () => {
    render(<DatePicker value="" onChange={vi.fn()} ariaLabel="Permit expiration date" />)

    expect(screen.getByRole('button', { name: /permit expiration date/i })).toHaveTextContent(
      /select date/i,
    )
  })

  it('shows the selected date, formatted', () => {
    const { trigger } = setup()

    expect(trigger).toHaveTextContent('Jun 4, 2026')
  })

  it('opens a calendar on the selected date’s month', async () => {
    const { user, trigger } = setup()

    await user.click(trigger)

    expect(within(screen.getByRole('dialog')).getByText('June 2026')).toBeInTheDocument()
  })

  it('selects a day, reporting it as an ISO date, and closes', async () => {
    const { user, trigger, onChange } = setup()

    await user.click(trigger)
    await user.click(within(screen.getByRole('dialog')).getByText('15'))

    expect(onChange).toHaveBeenCalledWith('2026-06-15')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks the selected day as pressed', async () => {
    const { user, trigger } = setup()

    await user.click(trigger)

    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: /june 4, 2026/i }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('navigates to the previous and next month', async () => {
    const { user, trigger } = setup()

    await user.click(trigger)
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /previous month/i }))
    expect(within(dialog).getByText('May 2026')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /next month/i }))
    await user.click(within(dialog).getByRole('button', { name: /next month/i }))
    expect(within(dialog).getByText('July 2026')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { user, trigger } = setup()

    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on an outside press', async () => {
    const { user, trigger } = setup()

    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
