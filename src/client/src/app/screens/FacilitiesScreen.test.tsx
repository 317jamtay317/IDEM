import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FacilitiesScreen } from './FacilitiesScreen'
import type { MyFacilitiesApi, MyFacility } from '../myFacilitiesApi'

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

const GOSHEN: MyFacility = { id: 'f1', name: 'Goshen Plant' }
const FORT_WAYNE: MyFacility = { id: 'f2', name: 'Fort Wayne Plant' }

/** In-memory MyFacilitiesApi with call spies. */
function makeApi(initial: MyFacility[] = [GOSHEN, FORT_WAYNE]) {
  let facilities = initial.map((f) => ({ ...f }))
  return {
    list: vi.fn(() => Promise.resolve(facilities.map((f) => ({ ...f })))),
    add: vi.fn((_t: string | null, name: string) => {
      const created = { id: `new-${name}`, name }
      facilities = [...facilities, created]
      return Promise.resolve(created)
    }),
    rename: vi.fn((_t: string | null, id: string, name: string) => {
      facilities = facilities.map((f) => (f.id === id ? { ...f, name } : f))
      return Promise.resolve(facilities.find((f) => f.id === id)!)
    }),
    remove: vi.fn((_t: string | null, id: string) => {
      facilities = facilities.filter((f) => f.id !== id)
      return Promise.resolve()
    }),
  } satisfies MyFacilitiesApi
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FacilitiesScreen — list (desktop grid)', () => {
  beforeEach(() => stubBreakpoint(true))

  it('renders loaded facilities in a labelled grid', async () => {
    render(<FacilitiesScreen accessToken="t" api={makeApi()} />)

    const grid = await screen.findByRole('table', { name: 'Facilities' })
    expect(within(grid).getByText('Goshen Plant')).toBeInTheDocument()
    expect(within(grid).getByText('Fort Wayne Plant')).toBeInTheDocument()
  })

  it('shows a loading message before data arrives', () => {
    const api = makeApi()
    api.list = vi.fn(() => new Promise(() => {}))
    render(<FacilitiesScreen accessToken="t" api={api} />)

    expect(screen.getByText(/loading facilities/i)).toBeInTheDocument()
  })

  it('shows the empty grid message when there are no facilities', async () => {
    render(<FacilitiesScreen accessToken="t" api={makeApi([])} />)

    expect(await screen.findByText(/no facilities yet/i)).toBeInTheDocument()
  })

  it('shows an error when the load fails', async () => {
    const api = makeApi()
    api.list = vi.fn(() => Promise.reject(new Error('boom')))
    render(<FacilitiesScreen accessToken="t" api={api} />)

    await waitFor(() => expect(screen.getByText(/error:/i)).toBeInTheDocument())
  })
})

describe('FacilitiesScreen — add (inline add row)', () => {
  beforeEach(() => stubBreakpoint(true))

  it('adds a row, types a name, and creates the Facility', async () => {
    const api = makeApi([])
    const user = userEvent.setup()
    render(<FacilitiesScreen accessToken="tok" api={api} />)

    await screen.findByRole('table', { name: 'Facilities' })
    await user.click(screen.getByRole('button', { name: /add facility/i }))
    await user.type(screen.getByLabelText(/facility name/i), 'Indianapolis Plant')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.add).toHaveBeenCalledWith('tok', 'Indianapolis Plant')
    expect(await screen.findByText('Indianapolis Plant')).toBeInTheDocument()
  })

  it('does not create when the name is blank', async () => {
    const api = makeApi([])
    const user = userEvent.setup()
    render(<FacilitiesScreen accessToken="t" api={api} />)

    await screen.findByRole('table', { name: 'Facilities' })
    await user.click(screen.getByRole('button', { name: /add facility/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.add).not.toHaveBeenCalled()
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
  })
})

describe('FacilitiesScreen — rename (inline edit)', () => {
  beforeEach(() => stubBreakpoint(true))

  it('renames an existing facility', async () => {
    const api = makeApi([GOSHEN])
    const user = userEvent.setup()
    render(<FacilitiesScreen accessToken="tok" api={api} />)

    await screen.findByText('Goshen Plant')
    await user.click(screen.getByRole('button', { name: /^rename$/i }))
    const input = screen.getByLabelText(/facility name/i)
    await user.clear(input)
    await user.type(input, 'Goshen Asphalt Plant')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.rename).toHaveBeenCalledWith('tok', 'f1', 'Goshen Asphalt Plant')
    expect(await screen.findByText('Goshen Asphalt Plant')).toBeInTheDocument()
  })
})

describe('FacilitiesScreen — delete', () => {
  beforeEach(() => stubBreakpoint(true))

  it('asks for confirmation naming the facility, without deleting yet', async () => {
    const api = makeApi([GOSHEN, FORT_WAYNE])
    const user = userEvent.setup()
    render(<FacilitiesScreen accessToken="tok" api={api} />)

    await screen.findByText('Goshen Plant')
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])

    expect(api.remove).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText(/are you sure you want to delete goshen plant/i),
    ).toBeInTheDocument()
  })

  it('deletes the facility after the user confirms', async () => {
    const api = makeApi([GOSHEN, FORT_WAYNE])
    const user = userEvent.setup()
    render(<FacilitiesScreen accessToken="tok" api={api} />)

    await screen.findByText('Goshen Plant')
    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }))

    expect(api.remove).toHaveBeenCalledWith('tok', 'f1')
    await waitFor(() => expect(screen.queryByText('Goshen Plant')).not.toBeInTheDocument())
  })

  it('does not delete when the user cancels', async () => {
    const api = makeApi([GOSHEN])
    const user = userEvent.setup()
    render(<FacilitiesScreen accessToken="tok" api={api} />)

    await screen.findByText('Goshen Plant')
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }))

    expect(api.remove).not.toHaveBeenCalled()
    expect(screen.getByText('Goshen Plant')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('FacilitiesScreen — mobile cards', () => {
  beforeEach(() => stubBreakpoint(false))

  it('renders a create form and per-card actions instead of a table', async () => {
    render(<FacilitiesScreen accessToken="t" api={makeApi([GOSHEN])} />)

    await screen.findByText('Goshen Plant')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add facility/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^rename$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
  })

  it('creates a Facility from the card form', async () => {
    const api = makeApi([])
    const user = userEvent.setup()
    render(<FacilitiesScreen accessToken="tok" api={api} />)

    await screen.findByRole('button', { name: /add facility/i })
    await user.type(screen.getByLabelText(/facility name/i), 'Indianapolis Plant')
    await user.click(screen.getByRole('button', { name: /add facility/i }))

    expect(api.add).toHaveBeenCalledWith('tok', 'Indianapolis Plant')
  })
})
