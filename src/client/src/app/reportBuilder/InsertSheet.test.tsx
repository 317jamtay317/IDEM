import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsertSheet } from './InsertSheet'

describe('InsertSheet', () => {
  it('renders a dialog titled "Insert element" with a search box', () => {
    render(<InsertSheet onClose={vi.fn()} onInsert={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'Insert element' })
    expect(within(dialog).getByRole('searchbox', { name: /search/i })).toBeInTheDocument()
  })

  it('lists the palette items', () => {
    render(<InsertSheet onClose={vi.fn()} onInsert={vi.fn()} />)

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('button', { name: 'Label' })).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Chart' })).toBeInTheDocument()
  })

  it('filters items as the user types in the search box', async () => {
    const user = userEvent.setup()
    render(<InsertSheet onClose={vi.fn()} onInsert={vi.fn()} />)

    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByRole('searchbox'), 'line')

    expect(dialog.getByRole('button', { name: 'Line' })).toBeInTheDocument()
    expect(dialog.queryByRole('button', { name: 'Label' })).not.toBeInTheDocument()
  })

  it('reports the chosen type via onInsert', async () => {
    const onInsert = vi.fn()
    const user = userEvent.setup()
    render(<InsertSheet onClose={vi.fn()} onInsert={onInsert} />)

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Image' }))

    expect(onInsert).toHaveBeenCalledWith('image')
  })

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<InsertSheet onClose={onClose} onInsert={vi.fn()} />)

    await user.click(container.querySelector('.rb-sheet-overlay')!)

    expect(onClose).toHaveBeenCalled()
  })
})
