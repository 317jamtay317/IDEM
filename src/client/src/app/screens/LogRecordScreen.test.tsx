import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogRecordScreen } from './LogRecordScreen'
import type { ProductionField, ProductionFieldsApi } from '../productionFieldsApi'
import type { MyFacilitiesApi, MyFacility } from '../myFacilitiesApi'
import type { RecordsApi } from '../recordsApi'

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

/** A catalog client whose `list` resolves to the given fields. */
function catalogApiOf(fields: ProductionField[]): ProductionFieldsApi {
  return { list: vi.fn(() => Promise.resolve(fields)) } as unknown as ProductionFieldsApi
}

/** A facilities client whose `list` resolves to the given Facilities. */
function facilitiesApiOf(facs: MyFacility[]): MyFacilitiesApi {
  return { list: vi.fn(() => Promise.resolve(facs)) } as unknown as MyFacilitiesApi
}

describe('LogRecordScreen — Facility selection', () => {
  it('offers only the Org’s own live Facilities, never the static samples', async () => {
    const api = catalogApiOf([field({ propertyName: 'HotMix', friendlyName: 'Hot Mix' })])
    const facilitiesApi = facilitiesApiOf([{ id: 'fac-1', name: 'Riverside Plant' }])

    render(<LogRecordScreen accessToken="tok" api={api} facilitiesApi={facilitiesApi} />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Facility' })).toHaveTextContent('Riverside Plant'),
    )
    // The old prototype leaked static sample Facilities; they must be gone.
    expect(screen.queryByText('Goshen Asphalt Plant')).not.toBeInTheDocument()
    expect(screen.queryByText('Fort Wayne Plant')).not.toBeInTheDocument()
  })

  it('guides the user to add a Facility when their Org has none, instead of silently failing', async () => {
    const user = userEvent.setup()
    const api = catalogApiOf([field({ propertyName: 'HotMix', friendlyName: 'Hot Mix' })])
    const facilitiesApi = facilitiesApiOf([])
    const onManageFacilities = vi.fn()

    render(
      <LogRecordScreen
        accessToken="tok"
        api={api}
        facilitiesApi={facilitiesApi}
        onManageFacilities={onManageFacilities}
      />,
    )

    expect(await screen.findByText(/add a facility/i)).toBeInTheDocument()
    // No static sample Facilities, and no dead Save button.
    expect(screen.queryByText('Goshen Asphalt Plant')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save record' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /go to facilities/i }))
    expect(onManageFacilities).toHaveBeenCalledOnce()
  })
})

describe('LogRecordScreen — production entries', () => {
  it('starts with no pre-filled entries; the user adds the fields they want', async () => {
    const user = userEvent.setup()
    const api = catalogApiOf([
      field({ propertyName: 'HotMix', friendlyName: 'Hot Mix' }),
      field({ propertyName: 'ColdMix', friendlyName: 'Cold Mix' }),
    ])
    const facilitiesApi = facilitiesApiOf([{ id: 'fac-1', name: 'Riverside Plant' }])

    render(<LogRecordScreen accessToken="tok" api={api} facilitiesApi={facilitiesApi} />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Facility' })).toHaveTextContent('Riverside Plant'),
    )
    // Nothing is recorded until the user chooses a field.
    expect(screen.queryByRole('button', { name: 'Field' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add field/i }))

    // A new row defaults to the first available catalog field.
    expect(await screen.findByRole('button', { name: 'Field' })).toHaveTextContent('Hot Mix')
  })

  it('loads the live Production Field catalog into the field picker', async () => {
    const user = userEvent.setup()
    const api = catalogApiOf([
      field({ propertyName: 'HotMix', friendlyName: 'Hot Mix' }),
      field({ propertyName: 'SteelSlag', friendlyName: 'Steel Slag' }),
    ])
    const facilitiesApi = facilitiesApiOf([{ id: 'fac-1', name: 'Riverside Plant' }])

    render(<LogRecordScreen accessToken="tok" api={api} facilitiesApi={facilitiesApi} />)

    await waitFor(() => expect(api.list).toHaveBeenCalledWith('tok'))
    await user.click(await screen.findByRole('button', { name: /add field/i }))

    await user.click(screen.getByRole('button', { name: 'Field' }))
    await user.type(screen.getByPlaceholderText('Search fields…'), 'steel')

    expect(await screen.findByRole('option', { name: 'Steel Slag' })).toBeInTheDocument()
  })
})

describe('LogRecordScreen — save', () => {
  function recordsApiOf(): { recordsApi: RecordsApi; create: ReturnType<typeof vi.fn> } {
    const create = vi.fn(() =>
      Promise.resolve({ id: 'r1', facilityId: 'fac-1', date: '2026-06-05', values: [] }),
    )
    return { recordsApi: { create } as unknown as RecordsApi, create }
  }

  it('posts the chosen Facility, date and numeric value under the field’s PropertyName', async () => {
    const user = userEvent.setup()
    const api = catalogApiOf([field({ propertyName: 'HotMix', friendlyName: 'Hot Mix', dataType: 'Decimal' })])
    const facilitiesApi = facilitiesApiOf([{ id: 'fac-1', name: 'Riverside Plant' }])
    const { recordsApi, create } = recordsApiOf()

    render(
      <LogRecordScreen
        accessToken="tok"
        api={api}
        facilitiesApi={facilitiesApi}
        recordsApi={recordsApi}
      />,
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Facility' })).toHaveTextContent('Riverside Plant'),
    )
    await user.click(await screen.findByRole('button', { name: /add field/i }))
    const valueInput = await screen.findByLabelText('Hot Mix value')
    await user.clear(valueInput)
    await user.type(valueInput, '1240')

    await user.click(screen.getByRole('button', { name: 'Save record' }))

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({
          facilityId: 'fac-1',
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          values: [{ propertyName: 'HotMix', numericValue: 1240 }],
        }),
      ),
    )
    expect(await screen.findByText('Record saved')).toBeInTheDocument()
  })

  it('records a Boolean field as a true/false value, not a tonnage', async () => {
    const user = userEvent.setup()
    const api = catalogApiOf([
      field({ propertyName: 'GeneratorRan', friendlyName: 'Generator Ran', dataType: 'Boolean' }),
    ])
    const facilitiesApi = facilitiesApiOf([{ id: 'fac-1', name: 'Riverside Plant' }])
    const { recordsApi, create } = recordsApiOf()

    render(
      <LogRecordScreen
        accessToken="tok"
        api={api}
        facilitiesApi={facilitiesApi}
        recordsApi={recordsApi}
      />,
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Facility' })).toHaveTextContent('Riverside Plant'),
    )
    await user.click(await screen.findByRole('button', { name: /add field/i }))
    // The Boolean field renders a checkbox, not a numeric input.
    await user.click(await screen.findByLabelText('Generator Ran'))

    await user.click(screen.getByRole('button', { name: 'Save record' }))

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({
          values: [{ propertyName: 'GeneratorRan', booleanValue: true }],
        }),
      ),
    )
  })

  it('shows an error message when saving fails', async () => {
    const user = userEvent.setup()
    const api = catalogApiOf([field({ propertyName: 'HotMix', friendlyName: 'Hot Mix' })])
    const facilitiesApi = facilitiesApiOf([{ id: 'fac-1', name: 'Riverside Plant' }])
    const recordsApi = {
      create: vi.fn(() => Promise.reject(new Error('Save failed (409)'))),
    } as unknown as RecordsApi

    render(
      <LogRecordScreen
        accessToken="tok"
        api={api}
        facilitiesApi={facilitiesApi}
        recordsApi={recordsApi}
      />,
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Facility' })).toHaveTextContent('Riverside Plant'),
    )
    await user.click(await screen.findByRole('button', { name: /add field/i }))
    await user.click(screen.getByRole('button', { name: 'Save record' }))

    expect(await screen.findByText(/save failed \(409\)/i)).toBeInTheDocument()
  })
})
