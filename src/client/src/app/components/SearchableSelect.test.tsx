import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchableSelect } from './SearchableSelect'

const fields = [
  'Hot Mix',
  'Cold Mix',
  'Warm Mix',
  'Recycled (RAP)',
  'Aggregate',
  'Liquid AC',
  'Fuel burned',
]

function setup(props: Partial<Parameters<typeof SearchableSelect>[0]> = {}) {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <SearchableSelect
      options={fields}
      value="Hot Mix"
      onChange={onChange}
      label="Field"
      searchPlaceholder="Search fields…"
      {...props}
    />,
  )
  return { user, onChange }
}

describe('SearchableSelect', () => {
  it('renders the selected value on a collapsed trigger', () => {
    setup()
    const trigger = screen.getByRole('button', { name: 'Field' })
    expect(trigger).toHaveTextContent('Hot Mix')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByPlaceholderText('Search fields…')).not.toBeInTheDocument()
  })

  it('opens a focused search box listing every option when clicked', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Field' }))

    const search = screen.getByPlaceholderText('Search fields…')
    expect(search).toBeInTheDocument()
    expect(search).toHaveFocus()
    expect(screen.getAllByRole('option')).toHaveLength(fields.length)
  })

  it('filters options by the search query, case-insensitively', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Field' }))
    await user.type(screen.getByPlaceholderText('Search fields…'), 'mix')

    expect(screen.getByRole('option', { name: 'Hot Mix' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cold Mix' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Warm Mix' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Aggregate' })).not.toBeInTheDocument()
  })

  it('marks the current value as the selected option', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Field' }))

    expect(screen.getByRole('option', { name: 'Hot Mix' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: 'Cold Mix' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('calls onChange with the chosen option and closes the popover', async () => {
    const { user, onChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Field' }))
    await user.click(screen.getByRole('option', { name: 'Warm Mix' }))

    expect(onChange).toHaveBeenCalledWith('Warm Mix')
    expect(screen.queryByPlaceholderText('Search fields…')).not.toBeInTheDocument()
  })

  it('closes the popover when Escape is pressed', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Field' }))
    expect(screen.getByPlaceholderText('Search fields…')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByPlaceholderText('Search fields…')).not.toBeInTheDocument()
  })

  it('closes the popover when the user clicks outside it', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Field' }))
    expect(screen.getByPlaceholderText('Search fields…')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByPlaceholderText('Search fields…')).not.toBeInTheDocument()
  })

  it('shows an empty state when no option matches the query', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Field' }))
    await user.type(screen.getByPlaceholderText('Search fields…'), 'zzz')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/no matches/i)).toBeInTheDocument()
  })
})
