import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FacilityDetailScreen } from './FacilityDetailScreen'
import type { MyFacilitiesApi, MyFacility, Permit, MonthlyLimit } from '../myFacilitiesApi'

const GOSHEN: MyFacility = { id: 'f1', name: 'Goshen Plant' }

/** In-memory MyFacilitiesApi with call spies, seeded with optional permits/limits. */
function makeApi(opts?: { facilities?: MyFacility[]; permits?: Permit[]; limits?: MonthlyLimit[] }) {
  let facilities = (opts?.facilities ?? [GOSHEN]).map((f) => ({ ...f }))
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

afterEach(() => vi.clearAllMocks())

describe('FacilityDetailScreen — loading', () => {
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

  it('calls onBack from the back control', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="t" api={makeApi()} onBack={onBack} />)

    await screen.findByRole('heading', { name: 'Goshen Plant' })
    await user.click(screen.getByRole('button', { name: /back to facilities/i }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('FacilityDetailScreen — permits', () => {
  it('renders the facility permits', async () => {
    const api = makeApi({ permits: [{ id: 'p1', expirationDate: '2027-01-01', value: 'PERMIT-1' }] })
    render(<FacilityDetailScreen facilityId="f1" accessToken="t" api={api} onBack={vi.fn()} />)

    expect(await screen.findByText('PERMIT-1')).toBeInTheDocument()
  })

  it('adds a permit', async () => {
    const api = makeApi()
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="tok" api={api} onBack={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Goshen Plant' })
    fireEvent.change(screen.getByLabelText(/permit expiration date/i), {
      target: { value: '2027-01-01' },
    })
    await user.type(screen.getByLabelText(/permit number/i), 'PERMIT-9')
    await user.click(screen.getByRole('button', { name: /add permit/i }))

    expect(api.addPermit).toHaveBeenCalledWith('tok', 'f1', {
      expirationDate: '2027-01-01',
      value: 'PERMIT-9',
    })
    expect(await screen.findByText('PERMIT-9')).toBeInTheDocument()
  })

  it('deletes a permit', async () => {
    const api = makeApi({ permits: [{ id: 'p1', expirationDate: '2027-01-01', value: 'PERMIT-1' }] })
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="tok" api={api} onBack={vi.fn()} />)

    await screen.findByText('PERMIT-1')
    await user.click(screen.getByRole('button', { name: /delete permit PERMIT-1/i }))

    expect(api.removePermit).toHaveBeenCalledWith('tok', 'f1', 'p1')
    await waitFor(() => expect(screen.queryByText('PERMIT-1')).not.toBeInTheDocument())
  })
})

describe('FacilityDetailScreen — monthly limits', () => {
  // The add-form <select> renders every Emission Type as an <option>, so a plain
  // text query for a type name (e.g. "VOC") is ambiguous. These tests target the
  // unique per-limit value text ("5 tons/month") and the per-limit action buttons.
  it('renders the facility limits in tons per month', async () => {
    const api = makeApi({ limits: [{ emissionType: 'VOC', value: 5 }] })
    render(<FacilityDetailScreen facilityId="f1" accessToken="t" api={api} onBack={vi.fn()} />)

    expect(await screen.findByText(/5 tons\/month/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit VOC limit/i })).toBeInTheDocument()
  })

  it('adds a monthly limit', async () => {
    const api = makeApi()
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="tok" api={api} onBack={vi.fn()} />)

    await screen.findByRole('heading', { name: 'Monthly Limits' })
    await user.selectOptions(screen.getByLabelText(/emission type/i), 'NOx')
    await user.type(screen.getByLabelText(/limit value/i), '7')
    await user.click(screen.getByRole('button', { name: /add limit/i }))

    expect(api.addLimit).toHaveBeenCalledWith('tok', 'f1', { emissionType: 'NOx', value: 7 })
    expect(await screen.findByText(/7 tons\/month/i)).toBeInTheDocument()
  })

  it('edits a limit value', async () => {
    const api = makeApi({ limits: [{ emissionType: 'VOC', value: 5 }] })
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="tok" api={api} onBack={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /edit VOC limit/i }))
    const input = screen.getByLabelText(/new value for VOC/i)
    await user.clear(input)
    await user.type(input, '8')
    await user.click(screen.getByRole('button', { name: /save VOC limit/i }))

    expect(api.updateLimit).toHaveBeenCalledWith('tok', 'f1', 'VOC', 8)
    expect(await screen.findByText(/8 tons\/month/i)).toBeInTheDocument()
  })

  it('deletes a limit', async () => {
    const api = makeApi({ limits: [{ emissionType: 'VOC', value: 5 }] })
    const user = userEvent.setup()
    render(<FacilityDetailScreen facilityId="f1" accessToken="tok" api={api} onBack={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /delete VOC limit/i }))

    expect(api.removeLimit).toHaveBeenCalledWith('tok', 'f1', 'VOC')
    await waitFor(() => expect(screen.queryByText(/5 tons\/month/i)).not.toBeInTheDocument())
  })
})
