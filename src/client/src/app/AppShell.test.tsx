import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from './AppShell'

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

function renderShell() {
  return render(<AppShell email="ops@rieth-riley.com" isSiteAdmin={false} onSignOut={vi.fn()} />)
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.location.hash = ''
})

describe('AppShell — hash-driven navigation', () => {
  it('restores the screen named in the URL hash on load (survives a refresh)', () => {
    stubBreakpoint(true)
    window.location.hash = '#/records'

    renderShell()

    expect(screen.getByRole('table', { name: 'Records' })).toBeInTheDocument()
    // The dashboard must not also be mounted.
    expect(screen.queryByText('Recent records')).not.toBeInTheDocument()
  })

  it('shows the dashboard by default when the URL carries no hash', () => {
    stubBreakpoint(true)
    window.location.hash = ''

    renderShell()

    expect(screen.getByText('Recent records')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Records' })).not.toBeInTheDocument()
  })

  it('writes the active screen into the URL hash when navigating', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getAllByRole('button', { name: 'Records' })[0])

    expect(window.location.hash).toBe('#/records')
    expect(screen.getByRole('table', { name: 'Records' })).toBeInTheDocument()
  })

  it('keeps the screen after navigating then re-mounting (an actual refresh)', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    const { unmount } = renderShell()

    await user.click(screen.getAllByRole('button', { name: 'Reports' })[0])
    expect(window.location.hash).toBe('#/reports')

    // Simulate a browser refresh: tear the tree down and mount it fresh with
    // the hash the previous navigation left behind.
    unmount()
    renderShell()

    expect(screen.getByText('IDEM Reports')).toBeInTheDocument()
  })

  it('gives the log-record screen its own hash so it too survives a refresh', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: /log a record/i }))

    expect(window.location.hash).toBe('#/log')
    expect(screen.getByText('New production record')).toBeInTheDocument()
  })

  it('opens the More account screen and reflects it in the hash', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getAllByRole('button', { name: 'More' })[0])

    expect(window.location.hash).toBe('#/more')
    expect(screen.getByText('ops@rieth-riley.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
