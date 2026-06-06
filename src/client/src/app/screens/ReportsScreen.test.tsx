import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportsScreen } from './ReportsScreen'
import * as downloadModule from '../reportBuilder/download'
import type { ReportTemplatesApi, SavedReportTemplate } from '../reportTemplatesApi'

const saved: SavedReportTemplate[] = [
  {
    id: 't1',
    name: 'Monthly NOx Report',
    rdl: '<Report/>',
    createdAtUtc: '2026-06-01T10:00:00Z',
    updatedAtUtc: '2026-06-04T10:00:00Z',
  },
]

/** A fake {@link ReportTemplatesApi} that settles with the seeded list by default. */
function fakeApi(overrides: Partial<ReportTemplatesApi> = {}): ReportTemplatesApi {
  return {
    list: vi.fn().mockResolvedValue(saved),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
    renderPdf: vi.fn().mockResolvedValue(new Blob()),
    ...overrides,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('ReportsScreen', () => {
  it('lists the IDEM report filings', () => {
    render(<ReportsScreen />)

    expect(screen.getByText('Annual Emissions Inventory')).toBeInTheDocument()
  })

  it('offers a SiteAdmin an entry into the Report Builder (I-D13)', async () => {
    const onOpenReportBuilder = vi.fn()
    const user = userEvent.setup()
    render(<ReportsScreen isSiteAdmin onOpenReportBuilder={onOpenReportBuilder} api={fakeApi()} />)

    await user.click(screen.getByRole('button', { name: 'New Report Template' }))

    expect(onOpenReportBuilder).toHaveBeenCalledWith('new')
  })

  it('hides the Report Builder entry from Org Users (I-D13)', () => {
    render(<ReportsScreen isSiteAdmin={false} onOpenReportBuilder={vi.fn()} api={fakeApi()} />)

    expect(screen.queryByRole('button', { name: 'New Report Template' })).not.toBeInTheDocument()
  })

  it('lists the saved Report Templates for a SiteAdmin', async () => {
    render(<ReportsScreen isSiteAdmin onOpenReportBuilder={vi.fn()} api={fakeApi()} />)

    expect(await screen.findByText('Monthly NOx Report')).toBeInTheDocument()
  })

  it('does not fetch saved templates for an Org User', () => {
    const api = fakeApi()
    render(<ReportsScreen api={api} />)

    expect(api.list).not.toHaveBeenCalled()
  })

  it('opens the builder to edit a saved template', async () => {
    const onOpenReportBuilder = vi.fn()
    const user = userEvent.setup()
    render(<ReportsScreen isSiteAdmin onOpenReportBuilder={onOpenReportBuilder} api={fakeApi()} />)

    await user.click(await screen.findByRole('button', { name: 'Edit Monthly NOx Report' }))

    expect(onOpenReportBuilder).toHaveBeenCalledWith('t1')
  })

  it('renders a saved template to PDF via the engine', async () => {
    const openSpy = vi.spyOn(downloadModule, 'openPdfInNewTab').mockImplementation(() => {})
    const api = fakeApi()
    const user = userEvent.setup()
    render(<ReportsScreen isSiteAdmin onOpenReportBuilder={vi.fn()} accessToken="tok" api={api} />)

    await user.click(await screen.findByRole('button', { name: 'Download PDF for Monthly NOx Report' }))

    await waitFor(() => expect(api.renderPdf).toHaveBeenCalledWith('tok', '<Report/>'))
    expect(openSpy).toHaveBeenCalled()
  })

  it('deletes a saved template after confirming, then refreshes the list', async () => {
    const api = fakeApi({ list: vi.fn().mockResolvedValueOnce(saved).mockResolvedValue([]) })
    const user = userEvent.setup()
    render(<ReportsScreen isSiteAdmin onOpenReportBuilder={vi.fn()} accessToken="tok" api={api} />)

    await user.click(await screen.findByRole('button', { name: 'Delete Monthly NOx Report' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete Monthly NOx Report' }))

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('tok', 't1'))
    // The list reloads (now empty), so the card is gone.
    await waitFor(() => expect(screen.queryByText('Monthly NOx Report')).not.toBeInTheDocument())
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const api = fakeApi()
    const user = userEvent.setup()
    render(<ReportsScreen isSiteAdmin onOpenReportBuilder={vi.fn()} accessToken="tok" api={api} />)

    await user.click(await screen.findByRole('button', { name: 'Delete Monthly NOx Report' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(api.remove).not.toHaveBeenCalled()
    expect(screen.getByText('Monthly NOx Report')).toBeInTheDocument()
  })

  it('shows an empty state when a SiteAdmin has no saved templates', async () => {
    render(
      <ReportsScreen
        isSiteAdmin
        onOpenReportBuilder={vi.fn()}
        api={fakeApi({ list: vi.fn().mockResolvedValue([]) })}
      />,
    )

    expect(await screen.findByText(/No saved report templates/i)).toBeInTheDocument()
  })
})
