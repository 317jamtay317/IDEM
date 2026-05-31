import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgsScreen } from './OrgsScreen'
import type { OrgsApi } from '../orgsApi'
import type { OrgSummary } from '../data'

/** Stub matchMedia so useBreakpoint resolves to the chosen tier. */
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

const RIETH: OrgSummary = {
  id: 'o1',
  name: 'Rieth-Riley',
  tenantId: null,
  facilities: [{ id: 'f1', name: 'Goshen Plant' }],
}
const ACME: OrgSummary = {
  id: 'o2',
  name: 'Acme Asphalt',
  tenantId: '11111111-1111-1111-1111-111111111111',
  facilities: [],
}

/** In-memory OrgsApi with call spies. */
function makeApi(initial: OrgSummary[] = [RIETH, ACME]) {
  let orgs = initial.map((o) => ({ ...o }))
  return {
    list: vi.fn(() => Promise.resolve(orgs.map((o) => ({ ...o })))),
    create: vi.fn((_t: string | null, name: string) => {
      const created = { id: `new-${name}`, name, tenantId: null, facilities: [] }
      orgs = [...orgs, created]
      return Promise.resolve(created)
    }),
    update: vi.fn((_t: string | null, id: string, name: string, tenantId: string | null) => {
      orgs = orgs.map((o) => (o.id === id ? { ...o, name, tenantId } : o))
      return Promise.resolve(orgs.find((o) => o.id === id)!)
    }),
    remove: vi.fn((_t: string | null, id: string) => {
      orgs = orgs.filter((o) => o.id !== id)
      return Promise.resolve()
    }),
  } satisfies OrgsApi
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OrgsScreen — list (desktop grid)', () => {
  beforeEach(() => stubBreakpoint(true))

  it('renders loaded orgs in a labelled grid', async () => {
    render(<OrgsScreen accessToken="t" api={makeApi()} />)

    const grid = await screen.findByRole('table', { name: 'Organizations' })
    expect(within(grid).getByText('Rieth-Riley')).toBeInTheDocument()
    expect(within(grid).getByText('Acme Asphalt')).toBeInTheDocument()
  })

  it('shows SSO status derived from tenantId', async () => {
    render(<OrgsScreen accessToken="t" api={makeApi()} />)

    const grid = await screen.findByRole('table', { name: 'Organizations' })
    expect(within(grid).getByText('Entra ID')).toBeInTheDocument()
    expect(within(grid).getByText('Local')).toBeInTheDocument()
  })

  it('shows a loading message before data arrives', () => {
    const api = makeApi()
    api.list = vi.fn(() => new Promise(() => {}))
    render(<OrgsScreen accessToken="t" api={api} />)

    expect(screen.getByText(/loading organizations/i)).toBeInTheDocument()
  })

  it('shows the empty grid message when there are no orgs', async () => {
    render(<OrgsScreen accessToken="t" api={makeApi([])} />)

    expect(await screen.findByText(/no organizations yet/i)).toBeInTheDocument()
  })

  it('shows an error when the load fails', async () => {
    const api = makeApi()
    api.list = vi.fn(() => Promise.reject(new Error('boom')))
    render(<OrgsScreen accessToken="t" api={api} />)

    await waitFor(() => expect(screen.getByText(/error:/i)).toBeInTheDocument())
  })
})

describe('OrgsScreen — create (inline add row)', () => {
  beforeEach(() => stubBreakpoint(true))

  it('adds a row, types a name, and creates the Org', async () => {
    const api = makeApi([])
    const user = userEvent.setup()
    render(<OrgsScreen accessToken="tok" api={api} />)

    await screen.findByRole('table', { name: 'Organizations' })
    await user.click(screen.getByRole('button', { name: /add organization/i }))
    await user.type(screen.getByLabelText(/organization name/i), 'Globex Paving')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.create).toHaveBeenCalledWith('tok', 'Globex Paving')
    expect(await screen.findByText('Globex Paving')).toBeInTheDocument()
  })

  it('does not create when the name is blank', async () => {
    const api = makeApi([])
    const user = userEvent.setup()
    render(<OrgsScreen accessToken="t" api={api} />)

    await screen.findByRole('table', { name: 'Organizations' })
    await user.click(screen.getByRole('button', { name: /add organization/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.create).not.toHaveBeenCalled()
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
  })
})

describe('OrgsScreen — configure SSO (inline edit)', () => {
  beforeEach(() => stubBreakpoint(true))

  it('edits a row and sets the tenant id', async () => {
    const api = makeApi([RIETH])
    const user = userEvent.setup()
    render(<OrgsScreen accessToken="tok" api={api} />)

    await screen.findByText('Rieth-Riley')
    await user.click(screen.getByRole('button', { name: /configure sso/i }))
    await user.type(screen.getByLabelText(/tenant id/i), 'abc-123')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.update).toHaveBeenCalledWith('tok', 'o1', 'Rieth-Riley', 'abc-123')
    expect(await screen.findByText('Entra ID')).toBeInTheDocument()
  })

  it('disables SSO when the tenant id is cleared', async () => {
    const api = makeApi([ACME])
    const user = userEvent.setup()
    render(<OrgsScreen accessToken="tok" api={api} />)

    await screen.findByText('Acme Asphalt')
    await user.click(screen.getByRole('button', { name: /configure sso/i }))
    await user.clear(screen.getByLabelText(/tenant id/i))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.update).toHaveBeenCalledWith('tok', 'o2', 'Acme Asphalt', null)
  })

  it('does not rename an existing org (name is read-only in edit)', async () => {
    const api = makeApi([RIETH])
    const user = userEvent.setup()
    render(<OrgsScreen accessToken="tok" api={api} />)

    await screen.findByText('Rieth-Riley')
    await user.click(screen.getByRole('button', { name: /configure sso/i }))

    // No editable "Organization name" field appears for an existing row.
    expect(screen.queryByLabelText(/organization name/i)).not.toBeInTheDocument()
  })
})

describe('OrgsScreen — delete', () => {
  beforeEach(() => stubBreakpoint(true))

  it('deletes an Org', async () => {
    const api = makeApi([RIETH, ACME])
    const user = userEvent.setup()
    render(<OrgsScreen accessToken="tok" api={api} />)

    await screen.findByText('Rieth-Riley')
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    expect(api.remove).toHaveBeenCalledWith('tok', 'o1')
    await waitFor(() => expect(screen.queryByText('Rieth-Riley')).not.toBeInTheDocument())
  })
})

describe('OrgsScreen — mobile cards', () => {
  beforeEach(() => stubBreakpoint(false))

  it('renders a create form and per-card actions instead of a table', async () => {
    render(<OrgsScreen accessToken="t" api={makeApi([RIETH])} />)

    await screen.findByText('Rieth-Riley')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add organization/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /configure sso/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('creates an Org from the card form', async () => {
    const api = makeApi([])
    const user = userEvent.setup()
    render(<OrgsScreen accessToken="tok" api={api} />)

    await screen.findByRole('button', { name: /add organization/i })
    await user.type(screen.getByLabelText(/organization name/i), 'Globex Paving')
    await user.click(screen.getByRole('button', { name: /add organization/i }))

    expect(api.create).toHaveBeenCalledWith('tok', 'Globex Paving')
  })
})
