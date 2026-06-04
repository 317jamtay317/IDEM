import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogRecordScreen } from './LogRecordScreen'
import type { ProductionField, ProductionFieldsApi } from '../productionFieldsApi'
import type { MyFacilitiesApi } from '../myFacilitiesApi'
import type { RecordsApi } from '../recordsApi'

function field(overrides: Partial<ProductionField> & Pick<ProductionField, 'propertyName' | 'friendlyName'>): ProductionField {
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

describe('LogRecordScreen production entries', () => {
  it('lets the user search and pick a Field for a production entry', async () => {
    const user = userEvent.setup()
    render(<LogRecordScreen />)

    // The first seeded entry defaults to "Hot Mix".
    const fieldTrigger = screen.getAllByRole('button', { name: 'Field' })[0]
    expect(fieldTrigger).toHaveTextContent('Hot Mix')

    await user.click(fieldTrigger)
    await user.type(screen.getByPlaceholderText('Search fields…'), 'agg')
    await user.click(screen.getByRole('option', { name: 'Aggregate' }))

    expect(fieldTrigger).toHaveTextContent('Aggregate')
  })

  it('loads the live Production Field catalog into the picker when authenticated', async () => {
    const user = userEvent.setup()
    const steelSlag = field({ propertyName: 'SteelSlag', friendlyName: 'Steel Slag' })
    const api = {
      list: vi.fn(() => Promise.resolve([steelSlag])),
    } as unknown as ProductionFieldsApi

    render(<LogRecordScreen accessToken="tok" api={api} />)

    await waitFor(() => expect(api.list).toHaveBeenCalledWith('tok'))

    await user.click(screen.getAllByRole('button', { name: 'Field' })[0])
    await user.type(screen.getByPlaceholderText('Search fields…'), 'steel')

    expect(await screen.findByRole('option', { name: 'Steel Slag' })).toBeInTheDocument()
  })
})

describe('LogRecordScreen save', () => {
  function authedApis() {
    const catalogApi = {
      list: vi.fn(() =>
        Promise.resolve([
          field({ propertyName: 'HotMix', friendlyName: 'Hot Mix' }),
          field({ propertyName: 'ColdMix', friendlyName: 'Cold Mix' }),
        ]),
      ),
    } as unknown as ProductionFieldsApi
    const facilitiesApi = {
      list: vi.fn(() => Promise.resolve([{ id: 'fac-1', name: 'Goshen Plant' }])),
    } as unknown as MyFacilitiesApi
    return { catalogApi, facilitiesApi }
  }

  it('posts a Record for the selected Facility and date when Save is clicked', async () => {
    const user = userEvent.setup()
    const { catalogApi, facilitiesApi } = authedApis()
    const recordsApi = {
      create: vi.fn(() =>
        Promise.resolve({ id: 'r1', facilityId: 'fac-1', date: '2026-05-29', values: [] }),
      ),
    } as unknown as RecordsApi

    render(
      <LogRecordScreen
        accessToken="tok"
        api={catalogApi}
        facilitiesApi={facilitiesApi}
        recordsApi={recordsApi}
      />,
    )

    // Wait for the live Facility to load and become the selection (shown by name).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Facility' })).toHaveTextContent('Goshen Plant'),
    )

    await user.click(screen.getByRole('button', { name: 'Save record' }))

    await waitFor(() =>
      expect(recordsApi.create).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({
          facilityId: 'fac-1',
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          values: expect.arrayContaining([
            expect.objectContaining({ propertyName: 'HotMix', numericValue: 1240 }),
          ]),
        }),
      ),
    )
    expect(await screen.findByText('Record saved')).toBeInTheDocument()
  })

  it('shows an error message when saving fails', async () => {
    const user = userEvent.setup()
    const { catalogApi, facilitiesApi } = authedApis()
    const recordsApi = {
      create: vi.fn(() => Promise.reject(new Error('Save failed (409)'))),
    } as unknown as RecordsApi

    render(
      <LogRecordScreen
        accessToken="tok"
        api={catalogApi}
        facilitiesApi={facilitiesApi}
        recordsApi={recordsApi}
      />,
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Facility' })).toHaveTextContent('Goshen Plant'),
    )
    await user.click(screen.getByRole('button', { name: 'Save record' }))

    expect(await screen.findByText(/save failed \(409\)/i)).toBeInTheDocument()
  })
})
