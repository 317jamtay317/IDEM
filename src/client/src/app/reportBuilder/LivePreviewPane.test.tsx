import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LivePreviewPane } from './LivePreviewPane'
import type { PreviewParticipant } from './previewHub'

const participant = (over: Partial<PreviewParticipant>): PreviewParticipant => ({
  connectionId: 'c',
  userId: 'u',
  displayName: 'Someone',
  color: '#2563eb',
  selectedElementIds: [],
  ...over,
})

describe('LivePreviewPane', () => {
  it('renders each page as an image and reports a live status', () => {
    render(<LivePreviewPane pages={['QUJD', 'REVG']} status="live" />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('src', 'data:image/png;base64,QUJD')
    expect(images[1]).toHaveAttribute('src', 'data:image/png;base64,REVG')
    expect(screen.getByRole('status')).toHaveTextContent(/live/i)
  })

  it('shows a waiting state until the first frame arrives', () => {
    render(<LivePreviewPane pages={[]} status="connecting" />)

    expect(screen.getByText(/waiting for the report/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('shows a custom waiting label when given one', () => {
    render(<LivePreviewPane pages={[]} status="connecting" waitingLabel="No report template selected." />)

    expect(screen.getByText('No report template selected.')).toBeInTheDocument()
  })

  it('surfaces a render error', () => {
    render(<LivePreviewPane pages={[]} status="live" renderError="The report template (RDL) must not be empty." />)

    expect(screen.getByText(/could not render the preview/i)).toBeInTheDocument()
  })

  it('shows an avatar for each other participant, filtering out itself', () => {
    const { container } = render(
      <LivePreviewPane
        pages={[]}
        status="connecting"
        selfConnectionId="conn-self"
        participants={[
          participant({ connectionId: 'conn-self', displayName: 'Me' }),
          participant({ connectionId: 'conn-2', displayName: 'Grace Hopper', color: '#2563eb' }),
        ]}
      />,
    )

    const avatars = container.querySelectorAll('.rp-avatar')
    expect(avatars).toHaveLength(1)
    expect(avatars[0]).toHaveAttribute('title', 'Grace Hopper')
    expect(avatars[0]).toHaveTextContent('GH')
    expect(screen.queryByTitle('Me')).not.toBeInTheDocument()
  })

  it('renders a close control that calls onClose, with the given accessible label', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <LivePreviewPane pages={[]} status="connecting" onClose={onClose} closeAriaLabel="Hide live preview" closeText="✕" />,
    )

    await user.click(screen.getByRole('button', { name: 'Hide live preview' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('omits the close control when no onClose is given', () => {
    render(<LivePreviewPane pages={[]} status="connecting" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
