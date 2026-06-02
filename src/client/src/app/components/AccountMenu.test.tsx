import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountMenu, AccountProvider, type AccountInfo } from './AccountMenu'
import { org } from '../data'

/** Render the menu inside a provider, with a sibling element to click "outside". */
function renderMenu(overrides: Partial<AccountInfo> = {}) {
  const value: AccountInfo = {
    email: 'ops@rieth-riley.com',
    isSiteAdmin: false,
    onSignOut: vi.fn(),
    ...overrides,
  }
  const utils = render(
    <AccountProvider value={value}>
      <AccountMenu triggerLabel="Open account menu" triggerClassName="topbar-avatar" />
      <button type="button">outside</button>
    </AccountProvider>,
  )
  return { ...utils, value }
}

describe('AccountMenu', () => {
  it('keeps the menu closed until the trigger is clicked', () => {
    renderMenu()

    expect(screen.getByRole('button', { name: 'Open account menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('opens to reveal the signed-in account and a Sign out action', async () => {
    const user = userEvent.setup()
    renderMenu()

    const trigger = screen.getByRole('button', { name: 'Open account menu' })
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('ops@rieth-riley.com')).toBeInTheDocument()
    expect(screen.getByText(org.name)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('shows the SiteAdmin badge only for SiteAdmins', async () => {
    const user = userEvent.setup()

    const { unmount } = renderMenu({ isSiteAdmin: false })
    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(screen.queryByText('SiteAdmin')).not.toBeInTheDocument()
    unmount()

    renderMenu({ isSiteAdmin: true })
    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(screen.getByText('SiteAdmin')).toBeInTheDocument()
  })

  it('signs out and closes the menu when Sign out is chosen', async () => {
    const user = userEvent.setup()
    const { value } = renderMenu()

    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(value.onSignOut).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('closes when clicking outside the menu', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('renders a non-interactive trigger when no account is in context', () => {
    render(<AccountMenu triggerLabel="Open account menu" triggerClassName="topbar-avatar" />)

    expect(screen.queryByRole('button', { name: 'Open account menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Open account menu' })).toBeInTheDocument()
  })
})
