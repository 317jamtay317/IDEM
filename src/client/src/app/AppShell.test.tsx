import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell, type AppShellProps } from './AppShell'

// The Organizations screen is the SiteAdmin's landing screen; stub its API so
// it settles to an empty list instead of reaching for the network in tests.
vi.mock('./orgsApi', () => ({
  orgsApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

// The Facilities screen is an Org User destination; stub its API so it settles
// without reaching for the network. `list` returns one Facility so the details
// page (reached via "Manage") can resolve it; permits/limits settle empty.
vi.mock('./myFacilitiesApi', () => ({
  EMISSION_TYPES: ['VOC', 'HCl', 'SO2', 'NOx', 'CO2'],
  myFacilitiesApi: {
    list: vi.fn().mockResolvedValue([{ id: 'f1', name: 'Goshen Plant' }]),
    add: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    listPermits: vi.fn().mockResolvedValue([]),
    addPermit: vi.fn(),
    removePermit: vi.fn(),
    listLimits: vi.fn().mockResolvedValue([]),
    addLimit: vi.fn(),
    updateLimit: vi.fn(),
    removeLimit: vi.fn(),
  },
}))

// The Reports screen (SiteAdmin) lists saved templates and the Report Builder loads
// one by id; stub the client so both settle without the network. `get` returns a
// minimal valid RDL the builder's `parseRdl` can reconstruct.
vi.mock('./reportTemplatesApi', () => ({
  reportTemplatesApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({
      id: 'annual-emissions',
      name: 'Annual Emissions Inventory',
      rdl:
        '<?xml version="1.0" encoding="utf-8"?>' +
        '<Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition"' +
        ' xmlns:rk="urn:recordkeeping:reportbuilder:v1">' +
        '<rk:Template id="annual-emissions" name="Annual Emissions Inventory" version="1"' +
        ' snapToGrid="true" gridSize="0.125"/>' +
        '<Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin>' +
        '<RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>' +
        '<Body><ReportItems/></Body></Report>',
      createdAtUtc: '2026-06-01T10:00:00Z',
      updatedAtUtc: '2026-06-04T10:00:00Z',
    }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    renderPdf: vi.fn().mockResolvedValue(new Blob()),
  },
}))

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

function renderShell(overrides: Partial<AppShellProps> = {}) {
  const props: AppShellProps = {
    email: 'ops@rieth-riley.com',
    isSiteAdmin: false,
    onSignOut: vi.fn(),
    ...overrides,
  }
  return { ...render(<AppShell {...props} />), props }
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

  it('highlights Records (not Dashboard) as the active tab on the log-record screen', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: /log a record/i }))

    // Logging a Record is a Records activity, so the navigation marks Records active.
    const records = screen.getAllByRole('button', { name: 'Records' })
    expect(records.some((button) => button.getAttribute('aria-current') === 'page')).toBe(true)
    const dashboard = screen.queryAllByRole('button', { name: 'Dashboard' })
    expect(dashboard.every((button) => button.getAttribute('aria-current') !== 'page')).toBe(true)
  })
})

describe('AppShell — account menu (replaces the More tab)', () => {
  it('no longer renders a More navigation tab', () => {
    stubBreakpoint(true)
    window.location.hash = ''

    renderShell()

    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    // The account menu is reachable instead (sidebar facility + top-bar avatar).
    expect(screen.getAllByRole('button', { name: 'Open account menu' }).length).toBeGreaterThan(0)
  })

  it('signs out from the sidebar facility account menu', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    const { props } = renderShell()

    // The sidebar facility trigger is the first account menu in the DOM.
    await user.click(screen.getAllByRole('button', { name: 'Open account menu' })[0])
    expect(screen.getByText('ops@rieth-riley.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(props.onSignOut).toHaveBeenCalledOnce()
  })

  it('opens the account menu from the top-bar avatar', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    renderShell()

    // The top-bar avatar trigger follows the sidebar facility one.
    await user.click(screen.getAllByRole('button', { name: 'Open account menu' })[1])

    expect(screen.getByText('ops@rieth-riley.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})

describe('AppShell — SiteAdmin sees only Organizations and Reports (I-D13)', () => {
  it('shows only Organizations and Reports in the navigation', async () => {
    stubBreakpoint(true)
    window.location.hash = ''

    renderShell({ isSiteAdmin: true })
    await screen.findAllByRole('button', { name: 'Organizations' })

    expect(screen.getAllByRole('button', { name: 'Reports' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Records' })).not.toBeInTheDocument()
  })

  it('lands on the Organizations screen by default, not the dashboard', async () => {
    stubBreakpoint(true)
    window.location.hash = ''

    renderShell({ isSiteAdmin: true })

    expect(await screen.findByRole('heading', { name: 'Organizations' })).toBeInTheDocument()
    expect(screen.queryByText('Recent records')).not.toBeInTheDocument()
  })

  it('redirects to Organizations when a hidden screen is requested by hash', async () => {
    stubBreakpoint(true)
    window.location.hash = '#/records'

    renderShell({ isSiteAdmin: true })

    expect(await screen.findByRole('heading', { name: 'Organizations' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Records' })).not.toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#/orgs'))
  })
})

describe('AppShell — Org User Facilities (I-D06)', () => {
  it('shows a Facilities tab and navigates to the Facilities screen', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    renderShell() // Org User by default

    await user.click(screen.getAllByRole('button', { name: 'Facilities' })[0])

    expect(window.location.hash).toBe('#/facilities')
    expect(await screen.findByRole('heading', { name: 'Facilities' })).toBeInTheDocument()
  })

  it('does not show Facilities to a SiteAdmin (I-D13)', async () => {
    stubBreakpoint(true)
    window.location.hash = ''

    renderShell({ isSiteAdmin: true })
    await screen.findAllByRole('button', { name: 'Organizations' })

    expect(screen.queryByRole('button', { name: 'Facilities' })).not.toBeInTheDocument()
  })

  it('opens a facility’s details page and navigates back to the list', async () => {
    stubBreakpoint(true)
    window.location.hash = ''
    const user = userEvent.setup()
    renderShell() // Org User by default

    await user.click(screen.getAllByRole('button', { name: 'Facilities' })[0])
    await user.click(await screen.findByRole('button', { name: /manage/i }))

    expect(window.location.hash).toBe('#/facilities/f1')
    expect(await screen.findByRole('heading', { name: 'Goshen Plant' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back to facilities/i }))

    expect(window.location.hash).toBe('#/facilities')
    expect(await screen.findByRole('heading', { name: 'Facilities' })).toBeInTheDocument()
  })

  it('deep-links to a facility’s details page from the URL hash', async () => {
    stubBreakpoint(true)
    window.location.hash = '#/facilities/f1'

    renderShell()

    expect(await screen.findByRole('heading', { name: 'Goshen Plant' })).toBeInTheDocument()
  })
})

describe('AppShell — Report Builder (SiteAdmin only, I-D13)', () => {
  it('opens the builder from the Reports screen for a SiteAdmin', async () => {
    stubBreakpoint(true)
    window.location.hash = '#/reports'
    const user = userEvent.setup()
    renderShell({ isSiteAdmin: true })

    await user.click(await screen.findByRole('button', { name: 'New Report Template' }))

    expect(
      await screen.findByRole('toolbar', { name: 'Report builder tools' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#/report-builder/new'))
  })

  it('restores the builder from the URL hash, loading the named template (survives a refresh)', async () => {
    stubBreakpoint(true)
    window.location.hash = '#/report-builder/annual-emissions'

    renderShell({ isSiteAdmin: true })

    // The builder loads the template named in the hash (online mode shows its name).
    expect(
      await screen.findByRole('toolbar', { name: 'Report builder tools' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Report name' })).toHaveValue(
      'Annual Emissions Inventory',
    )
  })

  it('redirects an Org User away from the builder, showing no builder (I-D13)', async () => {
    stubBreakpoint(true)
    window.location.hash = '#/report-builder/annual-emissions'

    renderShell() // Org User by default

    expect(await screen.findByText('Recent records')).toBeInTheDocument()
    expect(
      screen.queryByRole('toolbar', { name: 'Report builder tools' }),
    ).not.toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#/'))
  })

  it('returns to the Reports screen when the builder is closed', async () => {
    stubBreakpoint(true)
    window.location.hash = '#/report-builder/annual-emissions'
    const user = userEvent.setup()
    renderShell({ isSiteAdmin: true })

    await user.click(await screen.findByRole('button', { name: 'Back to Reports' }))

    expect(await screen.findByText('IDEM Reports')).toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#/reports'))
  })
})
