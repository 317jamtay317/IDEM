import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordsScreen } from './RecordsScreen'
import type { MyFacilitiesApi } from '../myFacilitiesApi'
import type { ProductionField, ProductionFieldsApi } from '../productionFieldsApi'
import type { RecordsApi } from '../recordsApi'

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

function field(
  overrides: Partial<ProductionField> & Pick<ProductionField, 'propertyName' | 'friendlyName'>,
): ProductionField {
  return {
    id: overrides.propertyName,
    description: null,
    dataType: 'Decimal',
    category: null,
    isSummary: true,
    displayOrder: 0,
    isActive: true,
    ...overrides,
  }
}

function makeApis() {
  const facilitiesApi = {
    list: vi.fn(() =>
      Promise.resolve([
        { id: 'goshen', name: 'Goshen Asphalt Plant' },
        { id: 'fort-wayne', name: 'Fort Wayne Plant' },
      ]),
    ),
  } as unknown as MyFacilitiesApi

  const fieldsApi = {
    list: vi.fn(() =>
      Promise.resolve([
        field({ propertyName: 'HotMix', friendlyName: 'Hot Mix', dataType: 'Decimal', displayOrder: 0 }),
        field({ propertyName: 'ColdMix', friendlyName: 'Cold Mix', dataType: 'Decimal', displayOrder: 1 }),
        field({ propertyName: 'IsOperated', friendlyName: 'Plant Ran', dataType: 'Boolean', displayOrder: 2 }),
        // A non-summary field must NOT become a column.
        field({ propertyName: 'Secret', friendlyName: 'Secret', isSummary: false, displayOrder: 3 }),
      ]),
    ),
  } as unknown as ProductionFieldsApi

  const recordsApi = {
    list: vi.fn(() =>
      Promise.resolve([
        {
          id: 'r1',
          facilityId: 'goshen',
          date: '2026-05-29',
          values: [
            { propertyName: 'HotMix', numericValue: 1240, booleanValue: null, dateValue: null },
            { propertyName: 'IsOperated', numericValue: null, booleanValue: true, dateValue: null },
            // ColdMix deliberately absent → rendered as a dash.
          ],
        },
      ]),
    ),
  } as unknown as RecordsApi

  return { facilitiesApi, fieldsApi, recordsApi }
}

function renderRecords(apis: ReturnType<typeof makeApis>) {
  return render(
    <RecordsScreen
      accessToken="tok"
      facilitiesApi={apis.facilitiesApi}
      fieldsApi={apis.fieldsApi}
      recordsApi={apis.recordsApi}
    />,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RecordsScreen — facility list (desktop)', () => {
  beforeEach(() => stubBreakpoint(true))

  it("lists the Org's facilities loaded from the API", async () => {
    const apis = makeApis()
    renderRecords(apis)

    await waitFor(() => expect(apis.facilitiesApi.list).toHaveBeenCalledWith('tok'))

    const grid = await screen.findByRole('table', { name: 'Records' })
    expect(within(grid).getByText('Goshen Asphalt Plant')).toBeInTheDocument()
    expect(within(grid).getByText('Fort Wayne Plant')).toBeInTheDocument()
  })

  it("drills into a facility's live Records, with a Date column plus one per Summary field", async () => {
    const apis = makeApis()
    const user = userEvent.setup()
    renderRecords(apis)

    await user.click(await screen.findByRole('button', { name: 'Goshen Asphalt Plant' }))

    await waitFor(() =>
      expect(apis.recordsApi.list).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ facilityId: 'goshen' }),
      ),
    )

    const grid = await screen.findByRole('table', { name: /records/i })
    for (const header of ['Date', 'Hot Mix', 'Cold Mix', 'Plant Ran']) {
      expect(within(grid).getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
    // A non-summary field is not surfaced as a column.
    expect(within(grid).queryByRole('columnheader', { name: 'Secret' })).not.toBeInTheDocument()
  })

  it('formats record values by data type, with a missing value shown as a dash', async () => {
    const apis = makeApis()
    const user = userEvent.setup()
    renderRecords(apis)

    await user.click(await screen.findByRole('button', { name: 'Goshen Asphalt Plant' }))

    const grid = await screen.findByRole('table', { name: /records/i })
    expect(within(grid).getByText('2026-05-29')).toBeInTheDocument() // Date
    expect(within(grid).getByText('1,240')).toBeInTheDocument() // Decimal, thousands-separated
    expect(within(grid).getByText('Yes')).toBeInTheDocument() // Boolean true
    expect(within(grid).getByText('—')).toBeInTheDocument() // ColdMix missing on this Record
  })

  it('filters the Records by a date range', async () => {
    const apis = makeApis()
    const user = userEvent.setup()
    renderRecords(apis)

    await user.click(await screen.findByRole('button', { name: 'Goshen Asphalt Plant' }))
    await screen.findByRole('table', { name: /records/i })

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-05-31' } })

    await waitFor(() =>
      expect(apis.recordsApi.list).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ facilityId: 'goshen', from: '2026-05-01', to: '2026-05-31' }),
      ),
    )
  })

  it('renders a boolean-false value as "No" and a Date field as its date', async () => {
    const user = userEvent.setup()
    const facilitiesApi = {
      list: vi.fn(() => Promise.resolve([{ id: 'goshen', name: 'Goshen Asphalt Plant' }])),
    } as unknown as MyFacilitiesApi
    const fieldsApi = {
      list: vi.fn(() =>
        Promise.resolve([
          field({ propertyName: 'IsOperated', friendlyName: 'Plant Ran', dataType: 'Boolean', displayOrder: 0 }),
          field({ propertyName: 'InspectionDate', friendlyName: 'Inspection', dataType: 'Date', displayOrder: 1 }),
        ]),
      ),
    } as unknown as ProductionFieldsApi
    const recordsApi = {
      list: vi.fn(() =>
        Promise.resolve([
          {
            id: 'r9',
            facilityId: 'goshen',
            date: '2026-05-29',
            values: [
              { propertyName: 'IsOperated', numericValue: null, booleanValue: false, dateValue: null },
              { propertyName: 'InspectionDate', numericValue: null, booleanValue: null, dateValue: '2026-06-01' },
            ],
          },
        ]),
      ),
    } as unknown as RecordsApi

    render(
      <RecordsScreen
        accessToken="tok"
        facilitiesApi={facilitiesApi}
        fieldsApi={fieldsApi}
        recordsApi={recordsApi}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Goshen Asphalt Plant' }))

    const grid = await screen.findByRole('table', { name: /records/i })
    expect(within(grid).getByText('No')).toBeInTheDocument()
    expect(within(grid).getByText('2026-06-01')).toBeInTheDocument()
  })

  it('returns to the facility list when Back is clicked', async () => {
    const apis = makeApis()
    const user = userEvent.setup()
    renderRecords(apis)

    await user.click(await screen.findByRole('button', { name: 'Goshen Asphalt Plant' }))
    await screen.findByRole('table', { name: /records/i })

    await user.click(screen.getByRole('button', { name: /back/i }))

    const grid = await screen.findByRole('table', { name: 'Records' })
    expect(within(grid).getByText('Goshen Asphalt Plant')).toBeInTheDocument()
  })
})

describe('RecordsScreen — facility cards (mobile)', () => {
  beforeEach(() => stubBreakpoint(false))

  it('renders facility cards and drills into live Records', async () => {
    const apis = makeApis()
    const user = userEvent.setup()
    renderRecords(apis)

    // No desktop table on mobile; the facility list is cards.
    expect(screen.queryByRole('table', { name: 'Records' })).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Goshen Asphalt Plant/ }))

    const grid = await screen.findByRole('table', { name: /records/i })
    expect(within(grid).getByRole('columnheader', { name: 'Hot Mix' })).toBeInTheDocument()
  })
})
