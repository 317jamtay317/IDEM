import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs } from './Tabs'

const tabs = [
  { id: 'a', label: 'First', content: <p>First content</p> },
  { id: 'b', label: 'Second', content: <p>Second content</p> },
]

describe('Tabs', () => {
  it('renders a tab per entry and shows the first panel by default', () => {
    render(<Tabs tabs={tabs} ariaLabel="Sections" />)

    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('First content')).toBeInTheDocument()
    expect(screen.queryByText('Second content')).not.toBeInTheDocument()
  })

  it('switches the panel when another tab is clicked', async () => {
    const user = userEvent.setup()
    render(<Tabs tabs={tabs} ariaLabel="Sections" />)

    await user.click(screen.getByRole('tab', { name: 'Second' }))

    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Second content')).toBeInTheDocument()
    expect(screen.queryByText('First content')).not.toBeInTheDocument()
  })

  it('exposes an accessible tablist with the given label', () => {
    render(<Tabs tabs={tabs} ariaLabel="Sections" />)

    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument()
  })
})
