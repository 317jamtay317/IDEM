import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportPreviewScreen } from './ReportPreviewScreen'
import type { PreviewHub } from '../reportBuilder/previewHub'

/** A fake PreviewHub that captures the frame/error handlers so a test can drive them. */
function fakeHub() {
  let frames: ((sid: string, pages: string[]) => void) | null = null
  let errors: ((sid: string, message: string) => void) | null = null
  const hub: PreviewHub = {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    join: vi.fn(async () => {}),
    pushRdl: vi.fn(async () => {}),
    onFrames: (handler) => {
      frames = handler
      return () => {
        frames = null
      }
    },
    onError: (handler) => {
      errors = handler
      return () => {
        errors = null
      }
    },
  }
  return {
    hub,
    emitFrames: (sid: string, pages: string[]) => act(() => frames?.(sid, pages)),
    emitError: (sid: string, message: string) => act(() => errors?.(sid, message)),
  }
}

describe('ReportPreviewScreen', () => {
  it('joins the session on mount and renders pushed frames as page images', async () => {
    const { hub, emitFrames } = fakeHub()
    render(
      <ReportPreviewScreen sessionId="tpl-1" accessToken="tok" onClose={() => {}} createHub={() => hub} />,
    )

    await waitFor(() => expect(hub.join).toHaveBeenCalledWith('tpl-1'))

    emitFrames('tpl-1', ['QUJD', 'REVG'])

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', 'data:image/png;base64,QUJD')
    expect(images[1]).toHaveAttribute('src', 'data:image/png;base64,REVG')
    expect(screen.getByRole('status')).toHaveTextContent(/live/i)
  })

  it('shows a waiting state until the first frame arrives', () => {
    const { hub } = fakeHub()
    render(<ReportPreviewScreen sessionId="tpl-1" onClose={() => {}} createHub={() => hub} />)

    expect(screen.getByText(/waiting for the report/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('ignores frames pushed for a different session', () => {
    const { hub, emitFrames } = fakeHub()
    render(<ReportPreviewScreen sessionId="tpl-1" onClose={() => {}} createHub={() => hub} />)

    emitFrames('other-session', ['QUJD'])

    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('surfaces a render error from the server', () => {
    const { hub, emitError } = fakeHub()
    render(<ReportPreviewScreen sessionId="tpl-1" onClose={() => {}} createHub={() => hub} />)

    emitError('tpl-1', 'The report template (RDL) must not be empty.')

    expect(screen.getByText(/could not render the preview/i)).toBeInTheDocument()
  })

  it('does not connect and shows an empty state when no session id is given', () => {
    const createHub = vi.fn()
    render(<ReportPreviewScreen sessionId={null} onClose={() => {}} createHub={createHub} />)

    expect(createHub).not.toHaveBeenCalled()
    expect(screen.getByText(/no report template selected/i)).toBeInTheDocument()
  })

  it('returns to Reports when the back button is clicked', async () => {
    const onClose = vi.fn()
    const { hub } = fakeHub()
    render(<ReportPreviewScreen sessionId="tpl-1" onClose={onClose} createHub={() => hub} />)

    await userEvent.click(screen.getByRole('button', { name: /back to reports/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
