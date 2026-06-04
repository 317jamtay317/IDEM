import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FacilityDetailScreen } from './FacilityDetailScreen'
import type { MyFacilitiesApi, MyFacility, Permit, MonthlyLimit } from '../myFacilitiesApi'

const GOSHEN: MyFacility = { id: 'f1', name: 'Goshen Plant' }

/** In-memory MyFacilitiesApi with call spies, seeded with optional permits/limits. */
function makeApi(opts?: { facilities?: MyFacility[]; permits?: Permit[]; limits?: MonthlyLimit[] }) {
  const facilities = (opts?.facilities ?? [GOSHEN]).map((f) => ({ ...f }))
  let permits = (opts?.permits ?? []).map((p) => ({ ...p }))
  let limits = (opts?.limits ?? []).map((l) => ({ ...l }))
  return {
    list: vi.fn(() => Promise.resolve(facilities.map((f) => ({ ...f })))),
    add: vi.fn(() => Promise.resolve(GOSHEN)),
    rename: vi.fn(() => Promise.resolve(GOSHEN)),
    remove: vi.fn(() => Promise.resolve()),
    listPermits: vi.fn(() => Promise.resolve(permits.map((p) => ({ ...p })))),
    addPermit: vi.fn((_t: string | null, _fid: string, p: { expirationDate: string; value: string }) => {
      const created = { id: `p-${p.value}`, ...p }
      permits = [...permits, created]
      return Promise.resolve(created)
    }),
    removePermit: vi.fn((_t: string | null, _fid: string, id: string) => {
      permits = permits.filter((p) => p.id !== id)
      return Promise.resolve()
    }),
    listLimits: vi.fn(() => Promise.resolve(limits.map((l) => ({ ...l })))),
    addLimit: vi.fn((_t: string | null, _fid: string, l: MonthlyLimit) => {
      limits = [...limits, { ...l }]
      return Promise.resolve({ ...l })
    }),
    updateLimit: vi.fn((_t: string | null, _fid: string, type: MonthlyLimit['emissionType'], value: number) => {
      limits = limits.map((l) => (l.emissionType === type ? { ...l, value } : l))
      return Promise.resolve({ emissionType: type, value })
    }),
    removeLimit: vi.fn((_t: string | null, _fid: string, type: MonthlyLimit['emissionType']) => {
      limits = limits.filter((l) => l.emissionType !== type)
      return Promise.resolve()
    }),
  } satisfies MyFacilitiesApi
}

/** Renders the screen and waits for the facility to resolve, then switches to the Limits tab. */
async function renderOnLimitsTab(api: MyFacilitiesApi) {
  const user = userEvent.setup()
  render(<FacilityDetailScreen facilityId="f1" accessToken="tok" api={api} onBack={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Goshen Plant' })
  await user.click(screen.getByRole('tab', { name: 'Monthly Limits' }))
  return { user, table: screen.getByRole('table', { name: 'Monthly limits' }) }
}

afterEach(() => vi.clearAllMocks())

describe('FacilityDetailScreen — loading & chrome', () => {
  it('shows the facility name once loaded', async () => {
    render(<FacilityDetailScreen facilityId="f1" accessToken="t" api={makeApi()} onBack={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Goshen Plant' })).toBeInTheDocument()
  })

  it('shows a not-found message when the facility is not in the Org', async () => {
    render(
      <FacilityDetailScreen facilityId="missing" accessToken="t" api={makeApi()} onBack={vi.fn()} />,
    )

    expect(await screen.findByText(/facility not found/i)).toBeInTheDocument()
  })

  it('renders the back control as an icon and calls onBack', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="t" api={makeApi()} onBack={onBack} />)

    await screen.findByRole('heading', { name: 'Goshen Plant' })
    const back = screen.getByRole('button', { name: /back to facilities/i })
    // Icon-only affordance beside the title — not a full-width text button.
    expect(back.querySelector('svg')).toBeInTheDocument()
    expect(back).not.toHaveTextContent(/facilities/i)

    await user.click(back)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('organizes Permits and Monthly Limits into tabs, Permits first', async () => {
    render(<FacilityDetailScreen facilityId="f1" accessToken="t" api={makeApi()} onBack={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Goshen Plant' })
    expect(screen.getByRole('tab', { name: 'Permits' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Monthly Limits' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('table', { name: 'Permits' })).toBeInTheDocument()
  })
})

describe('FacilityDetailScreen — permits tab', () => {
  it('renders the facility permits in the grid', async () => {
    const api = makeApi({ permits: [{ id: 'p1', expirationDate: '2027-01-01', value: 'PERMIT-1' }] })
    render(<FacilityDetailScreen facilityId="f1" accessToken="t" api={api} onBack={vi.fn()} />)

    expect(await screen.findByText('PERMIT-1')).toBeInTheDocument()
  })

  it('adds a permit via the grid inline add row', async () => {
    const api = makeApi()
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="tok" api={api} onBack={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Goshen Plant' })
    // No add-form card — the "+" opens a blank editable row inside the grid.
    await user.click(screen.getByRole('button', { name: /add permit/i }))
    await user.type(screen.getByLabelText(/permit number/i), 'PERMIT-9')
    // Expiration uses the custom calendar: open it and pick the 15th of the shown month.
    await user.click(screen.getByRole('button', { name: /permit expiration date/i }))
    await user.click(within(screen.getByRole('dialog')).getByText('15'))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.addPermit).toHaveBeenCalledWith('tok', 'f1', {
      expirationDate: expect.stringMatching(/^\d{4}-\d{2}-15$/),
      value: 'PERMIT-9',
    })
    expect(await screen.findByText('PERMIT-9')).toBeInTheDocument()
  })

  it('deletes a permit (permits are not editable in place)', async () => {
    const api = makeApi({ permits: [{ id: 'p1', expirationDate: '2027-01-01', value: 'PERMIT-1' }] })
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="tok" api={api} onBack={vi.fn()} />)

    await screen.findByText('PERMIT-1')
    const grid = screen.getByRole('table', { name: 'Permits' })
    // Permits have no inline Edit — only Delete.
    expect(within(grid).queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /delete permit PERMIT-1/i }))

    expect(api.removePermit).toHaveBeenCalledWith('tok', 'f1', 'p1')
    await waitFor(() => expect(screen.queryByText('PERMIT-1')).not.toBeInTheDocument())
  })
})

describe('FacilityDetailScreen — monthly limits tab', () => {
  it('renders the facility limits in the grid', async () => {
    const { table } = await renderOnLimitsTab(makeApi({ limits: [{ emissionType: 'VOC', value: 5 }] }))

    expect(await within(table).findByText('VOC')).toBeInTheDocument()
    expect(within(table).getByText('5')).toBeInTheDocument()
  })

  it('formats limit values with thousands separators', async () => {
    const { table } = await renderOnLimitsTab(
      makeApi({ limits: [{ emissionType: 'VOC', value: 152000 }] }),
    )

    expect(await within(table).findByText('152,000')).toBeInTheDocument()
  })

  it('adds a monthly limit via the grid inline add row', async () => {
    const api = makeApi()
    const { user, table } = await renderOnLimitsTab(api)

    // No add-form card — the "+" opens a blank editable row inside the grid.
    await user.click(screen.getByRole('button', { name: /add limit/i }))
    await user.selectOptions(screen.getByLabelText(/emission type/i), 'NOx')
    await user.type(screen.getByLabelText('Tons / month'), '7')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(api.addLimit).toHaveBeenCalledWith('tok', 'f1', { emissionType: 'NOx', value: 7 })
    expect(await within(table).findByText('NOx')).toBeInTheDocument()
  })

  it('offers only unused emission types in the inline add row', async () => {
    const api = makeApi({ limits: [{ emissionType: 'VOC', value: 5 }] })
    const { user } = await renderOnLimitsTab(api)

    await user.click(screen.getByRole('button', { name: /add limit/i }))
    const select = screen.getByLabelText(/emission type/i)
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).not.toContain('VOC')
    expect(options).toContain('NOx')
  })

  it('edits a limit value inline, with the emission type fixed', async () => {
    const api = makeApi({ limits: [{ emissionType: 'VOC', value: 5 }] })
    const { user, table } = await renderOnLimitsTab(api)

    await within(table).findByText('VOC')
    await user.click(within(table).getByRole('button', { name: /^edit$/i }))
    // Emission Type is the limit's identity — never a select on an existing row.
    expect(within(table).queryByLabelText(/emission type/i)).not.toBeInTheDocument()
    const input = screen.getByLabelText('Tons / month')
    await user.clear(input)
    await user.type(input, '8')
    await user.click(within(table).getByRole('button', { name: /^save$/i }))

    expect(api.updateLimit).toHaveBeenCalledWith('tok', 'f1', 'VOC', 8)
    expect(await within(table).findByText('8')).toBeInTheDocument()
  })

  it('deletes a limit', async () => {
    const api = makeApi({ limits: [{ emissionType: 'VOC', value: 5 }] })
    const { user, table } = await renderOnLimitsTab(api)

    await within(table).findByText('VOC')
    await user.click(within(table).getByRole('button', { name: /delete VOC limit/i }))

    expect(api.removeLimit).toHaveBeenCalledWith('tok', 'f1', 'VOC')
    await waitFor(() => expect(within(table).queryByText('VOC')).not.toBeInTheDocument())
  })
})
