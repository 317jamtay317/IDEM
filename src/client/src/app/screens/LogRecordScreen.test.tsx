import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogRecordScreen } from './LogRecordScreen'
import type { ProductionField, ProductionFieldsApi } from '../productionFieldsApi'

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
    const steelSlag: ProductionField = {
      id: '1',
      propertyName: 'SteelSlag',
      friendlyName: 'Steel Slag',
      description: null,
      dataType: 'Decimal',
      category: null,
      isSummary: true,
      displayOrder: 0,
      isActive: true,
    }
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
