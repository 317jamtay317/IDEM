import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportPreviewScreen } from './ReportPreviewScreen'
import type { PreviewHub, PreviewParticipant } from '../reportBuilder/previewHub'

/** A fake PreviewHub that captures the frame/error/presence handlers so a test can drive them. */
function fakeHub() {
  let frames: ((sid: string, pages: string[]) => void) | null = null
  let errors: ((sid: string, message: string) => void) | null = null
  let participants: ((sid: string, ps: PreviewParticipant[]) => void) | null = null
  const hub: PreviewHub = {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    join: vi.fn(async () => {}),
    pushRdl: vi.fn(async () => {}),
    updateSelection: vi.fn(async () => {}),
    claimElement: vi.fn(async () => null),
    releaseElement: vi.fn(async () => {}),
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
    onParticipants: (handler) => {
      participants = handler
      return () => {
        participants = null
      }
    },
    onLocks: vi.fn(() => () => {}),
    onReconnected: vi.fn(() => () => {}),
    connectionId: vi.fn(() => 'conn-self'),
  }
  return {
    hub,
    emitFrames: (sid: string, pages: string[]) => act(() => frames?.(sid, pages)),
    emitError: (sid: string, message: string) => act(() => errors?.(sid, message)),
    emitParticipants: (sid: string, ps: PreviewParticipant[]) => act(() => participants?.(sid, ps)),
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

  it('shows an avatar for each other participant, filtering out itself', async () => {
    const { hub, emitParticipants } = fakeHub()
    const { container } = render(
      <ReportPreviewScreen sessionId="tpl-1" accessToken="tok" onClose={() => {}} createHub={() => hub} />,
    )

    await waitFor(() => expect(hub.join).toHaveBeenCalledWith('tpl-1'))

    // The roster carries two participants: self (conn-self, matching the hub's connectionId()) and another.
    emitParticipants('tpl-1', [
      { connectionId: 'conn-self', userId: 'u1', displayName: 'Me', color: '#111', selectedElementIds: [] },
      { connectionId: 'conn-2', userId: 'u2', displayName: 'Grace Hopper', color: '#2563eb', selectedElementIds: [] },
    ])

    // Exactly the non-self participant is shown — self (conn-self) is filtered out, the other is kept.
    const avatars = container.querySelectorAll('.rp-avatar')
    expect(avatars).toHaveLength(1)
    expect(avatars[0]).toHaveAttribute('title', 'Grace Hopper')
    expect(avatars[0]).toHaveTextContent('GH')
    expect(screen.queryByTitle('Me')).not.toBeInTheDocument()
  })

  it('ignores participant updates for a different session', async () => {
    const { hub, emitParticipants } = fakeHub()
    const { container } = render(
      <ReportPreviewScreen sessionId="tpl-1" accessToken="tok" onClose={() => {}} createHub={() => hub} />,
    )

    await waitFor(() => expect(hub.join).toHaveBeenCalledWith('tpl-1'))
    emitParticipants('other-session', [
      { connectionId: 'conn-2', userId: 'u2', displayName: 'Grace', color: '#2563eb', selectedElementIds: [] },
    ])

    expect(container.querySelectorAll('.rp-avatar')).toHaveLength(0)
  })
})
