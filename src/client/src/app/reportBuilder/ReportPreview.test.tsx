import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportPreview } from './ReportPreview'
import { createSampleTemplate } from './sampleTemplate'
import { createElement } from './model'

describe('ReportPreview', () => {
  it('resolves data bindings in the rendered report', () => {
    render(<ReportPreview template={createSampleTemplate()} onClose={vi.fn()} />)

    const dialog = within(screen.getByRole('dialog', { name: 'Report preview' }))
    expect(dialog.getByText('Goshen Asphalt Plant')).toBeInTheDocument() // {Facility.Name}
    expect(dialog.getByText('2240.75')).toBeInTheDocument() // SUM({Record.Tons}) over the rows
  })

  it('expands the detail band to one row per detail record', () => {
    render(<ReportPreview template={createSampleTemplate()} onClose={vi.fn()} />)

    const dialog = within(screen.getByRole('dialog', { name: 'Report preview' }))
    expect(dialog.getByText('Hot Mix')).toBeInTheDocument()
    expect(dialog.getByText('Cold Mix')).toBeInTheDocument()
    expect(dialog.getByText('Steel Slag')).toBeInTheDocument()
  })

  it('resolves the footer page number for a single-page report', () => {
    render(<ReportPreview template={createSampleTemplate()} onClose={vi.fn()} />)

    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('renders one page surface per logical page', () => {
    const t = createSampleTemplate()
    t.bands[2].elements.push(createElement('pageBreak', 'pageBreak-1')) // a break → two pages

    const { container } = render(<ReportPreview template={t} onClose={vi.fn()} />)

    expect(container.querySelectorAll('.rb-preview-page')).toHaveLength(2)
  })

  it('numbers each page, applying the start-at offset', () => {
    const t = createSampleTemplate()
    t.bands[2].elements.push(createElement('pageBreak', 'pageBreak-1')) // two pages
    t.pageNumbers = { ...t.pageNumbers, format: 'Page {n}', startAt: 5 }

    render(<ReportPreview template={t} onClose={vi.fn()} />)

    expect(screen.getByText('Page 5')).toBeInTheDocument() // page one
    expect(screen.getByText('Page 6')).toBeInTheDocument() // page two
  })

  it('omits the footer page number when page numbers are off', () => {
    const t = createSampleTemplate()
    t.pageNumbers = { ...t.pageNumbers, show: false }

    render(<ReportPreview template={t} onClose={vi.fn()} />)

    expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument()
  })

  it('closes via the Close button and the backdrop', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(<ReportPreview template={createSampleTemplate()} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(container.querySelector('.rb-preview-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
