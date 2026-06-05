import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportsScreen } from './ReportsScreen'

describe('ReportsScreen', () => {
  it('lists the IDEM report filings', () => {
    render(<ReportsScreen />)

    expect(screen.getByText('Annual Emissions Inventory')).toBeInTheDocument()
  })

  it('offers a SiteAdmin an entry into the Report Builder (I-D13)', async () => {
    const onOpenReportBuilder = vi.fn()
    const user = userEvent.setup()
    render(<ReportsScreen isSiteAdmin onOpenReportBuilder={onOpenReportBuilder} />)

    await user.click(screen.getByRole('button', { name: 'New Report Template' }))

    expect(onOpenReportBuilder).toHaveBeenCalledWith('new')
  })

  it('hides the Report Builder entry from Org Users (I-D13)', () => {
    render(<ReportsScreen isSiteAdmin={false} onOpenReportBuilder={vi.fn()} />)

    expect(
      screen.queryByRole('button', { name: 'New Report Template' }),
    ).not.toBeInTheDocument()
  })
})
