import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductionFieldsScreen } from './ProductionFieldsScreen'
import type { ProductionField, ProductionFieldsApi } from '../productionFieldsApi'

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

const HOT: ProductionField = {
  id: 'pf1',
  propertyName: 'HotMix',
  friendlyName: 'Hot Mix',
  description: null,
  dataType: 'Decimal',
  category: 'Mixes',
  isSummary: true,
  displayOrder: 0,
  isActive: true,
}
const COLD: ProductionField = {
  id: 'pf2',
  propertyName: 'ColdMix',
  friendlyName: 'Cold Mix',
  description: null,
  dataType: 'Decimal',
  category: 'Mixes',
  isSummary: true,
  displayOrder: 1,
  isActive: true,
}

/** In-memory ProductionFieldsApi with call spies. */
function makeApi(initial: ProductionField[] = [HOT, COLD]) {
  let fields = initial.map((f) => ({ ...f }))
  return {
    list: vi.fn(() => Promise.resolve(fields.map((f) => ({ ...f })))),
    create: vi.fn((_t: string | null, input) => {
      const created: ProductionField = { id: `new-${input.propertyName}`, isActive: true, ...input }
      fields = [...fields, created]
      return Promise.resolve(created)
    }),
    update: vi.fn((_t: string | null, id: string, input) => {
      fields = fields.map((f) => (f.id === id ? { ...f, ...input } : f))
      return Promise.resolve(fields.find((f) => f.id === id)!)
    }),
    retire: vi.fn((_t: string | null, id: string) => {
      fields = fields.map((f) => (f.id === id ? { ...f, isActive: false } : f))
      return Promise.resolve(fields.find((f) => f.id === id)!)
    }),
    reactivate: vi.fn((_t: string | null, id: string) => {
      fields = fields.map((f) => (f.id === id ? { ...f, isActive: true } : f))
      return Promise.resolve(fields.find((f) => f.id === id)!)
    }),
  } satisfies ProductionFieldsApi
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProductionFieldsScreen — list (desktop grid)', () => {
  beforeEach(() => stubBreakpoint(true))

  it('renders loaded fields in a labelled grid', async () => {
    render(<ProductionFieldsScreen accessToken="t" api={makeApi()} />)

    const grid = await screen.findByRole('table', { name: 'Production Fields' })
    expect(within(grid).getByText('Hot Mix')).toBeInTheDocument()
    expect(within(grid).getByText('Cold Mix')).toBeInTheDocument()
    expect(within(grid).getByText('HotMix')).toBeInTheDocument()
  })

  it('shows a loading message before data arrives', () => {
    const api = makeApi()
    api.list = vi.fn(() => new Promise(() => {}))
    render(<ProductionFieldsScreen accessToken="t" api={api} />)

    expect(screen.getByText(/loading production fields/i)).toBeInTheDocument()
  })

  it('shows the empty message when there are no fields', async () => {
    render(<ProductionFieldsScreen accessToken="t" api={makeApi([])} />)

    expect(await screen.findByText(/no production fields yet/i)).toBeInTheDocument()
  })

  it('shows an error when the load fails', async () => {
    const api = makeApi()
    api.list = vi.fn(() => Promise.reject(new Error('boom')))
    render(<ProductionFieldsScreen accessToken="t" api={api} />)

    await waitFor(() => expect(screen.getByText(/error:/i)).toBeInTheDocument())
  })
})

describe('ProductionFieldsScreen — create (inline add row)', () => {
  beforeEach(() => stubBreakpoint(true))

  it('adds a row, enters key + label, and creates the field', async () => {
    const api = makeApi([])
    const user = userEvent.setup()
    render(<ProductionFieldsScreen accessToken="tok" api={api} />)

    await screen.findByRole('table', { name: 'Production Fields' })
    await user.click(screen.getByRole('button', { name: /add field/i }))
    await user.type(screen.getByLabelText(/property name/i), 'WarmMix')
    await user.type(screen.getByLabelText(/friendly name/i), 'Warm Mix')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.create).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ propertyName: 'WarmMix', friendlyName: 'Warm Mix', dataType: 'Decimal' }),
    )
    expect(await screen.findByText('Warm Mix')).toBeInTheDocument()
  })

  it('does not create when the key is blank', async () => {
    const api = makeApi([])
    const user = userEvent.setup()
    render(<ProductionFieldsScreen accessToken="t" api={api} />)

    await screen.findByRole('table', { name: 'Production Fields' })
    await user.click(screen.getByRole('button', { name: /add field/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.create).not.toHaveBeenCalled()
    expect(screen.getByText(/property name is required/i)).toBeInTheDocument()
  })
})

describe('ProductionFieldsScreen — edit and lifecycle', () => {
  beforeEach(() => stubBreakpoint(true))

  it('inline-edits a field and saves the new friendly name', async () => {
    const api = makeApi([HOT])
    const user = userEvent.setup()
    render(<ProductionFieldsScreen accessToken="tok" api={api} />)

    await screen.findByText('Hot Mix')
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    const input = screen.getByLabelText(/friendly name/i)
    await user.clear(input)
    await user.type(input, 'Hottest Mix')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.update).toHaveBeenCalledWith(
      'tok',
      'pf1',
      expect.objectContaining({ friendlyName: 'Hottest Mix' }),
    )
  })

  it('does not let an existing field change its property name (key is read-only)', async () => {
    const api = makeApi([HOT])
    const user = userEvent.setup()
    render(<ProductionFieldsScreen accessToken="tok" api={api} />)

    await screen.findByText('Hot Mix')
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    expect(screen.queryByLabelText(/property name/i)).not.toBeInTheDocument()
  })

  it('retires an active field', async () => {
    const api = makeApi([HOT])
    const user = userEvent.setup()
    render(<ProductionFieldsScreen accessToken="tok" api={api} />)

    await screen.findByText('Hot Mix')
    await user.click(screen.getByRole('button', { name: /^retire$/i }))

    expect(api.retire).toHaveBeenCalledWith('tok', 'pf1')
    expect(await screen.findByRole('button', { name: /^reactivate$/i })).toBeInTheDocument()
  })
})

describe('ProductionFieldsScreen — mobile cards', () => {
  beforeEach(() => stubBreakpoint(false))

  it('renders an add form and per-card actions instead of a table', async () => {
    render(<ProductionFieldsScreen accessToken="t" api={makeApi([HOT])} />)

    await screen.findByText('Hot Mix')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add field/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^retire$/i })).toBeInTheDocument()
  })
})
