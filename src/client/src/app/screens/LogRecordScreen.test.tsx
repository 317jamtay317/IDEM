import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogRecordScreen } from './LogRecordScreen'

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
})
