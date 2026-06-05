import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PageSetupEditor } from './PageSetupEditor'
import { type PageSetup } from './model'

const letter: PageSetup = {
  width: 8.5,
  height: 11,
  margins: { top: 1, right: 1, bottom: 1, left: 1 },
}

describe('PageSetupEditor', () => {
  it('is titled Page Setup', () => {
    render(<PageSetupEditor page={letter} onChange={vi.fn()} />)

    expect(screen.getByText('Page Setup')).toBeInTheDocument()
  })

  it('preselects the current page size', () => {
    render(<PageSetupEditor page={letter} onChange={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: 'Page size' })).toHaveValue('letter')
  })

  it('shows the current orientation as pressed', () => {
    render(<PageSetupEditor page={letter} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Landscape' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the current margins in inches', () => {
    render(<PageSetupEditor page={{ ...letter, margins: { top: 0.75, right: 0.5, bottom: 0.75, left: 0.5 } }} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Top')).toHaveValue(0.75)
    expect(screen.getByLabelText('Left')).toHaveValue(0.5)
  })

  it('changes the page size, keeping the margins', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PageSetupEditor page={letter} onChange={onChange} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Page size' }), 'legal')

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ width: 8.5, height: 14, margins: letter.margins }),
    )
  })

  it('switches to landscape by swapping the dimensions', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PageSetupEditor page={letter} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Landscape' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ width: 11, height: 8.5 }))
  })

  it('switches back to portrait by swapping the dimensions', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PageSetupEditor page={{ ...letter, width: 11, height: 8.5 }} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Portrait' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ width: 8.5, height: 11 }))
  })

  it('treats picking the Custom entry as a no-op', () => {
    const onChange = vi.fn()
    render(<PageSetupEditor page={{ ...letter, width: 8, height: 10 }} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Page size' }), { target: { value: 'custom' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('edits a single margin, leaving the others unchanged', () => {
    const onChange = vi.fn()
    render(<PageSetupEditor page={letter} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Top'), { target: { value: '0.5' } })

    expect(onChange).toHaveBeenCalledWith({ margins: { top: 0.5, right: 1, bottom: 1, left: 1 } })
  })

  it('offers a Custom option for a non-preset page size', () => {
    render(<PageSetupEditor page={{ ...letter, width: 8, height: 10 }} onChange={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: 'Page size' })).toHaveValue('custom')
  })
})
