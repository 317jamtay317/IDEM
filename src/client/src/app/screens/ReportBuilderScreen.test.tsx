import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, waitFor, within, fireEvent, createEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportBuilderScreen } from './ReportBuilderScreen'
import type { PreviewHub, PreviewParticipant } from '../reportBuilder/previewHub'
import * as downloadModule from '../reportBuilder/download'
import { toRdl } from '../reportBuilder/rdl'
import { createSampleTemplate } from '../reportBuilder/sampleTemplate'

/** A minimal stand-in for the browser DataTransfer used in drag events. */
function makeDataTransfer() {
  const store: Record<string, string> = {}
  return {
    setData: (key: string, value: string) => {
      store[key] = value
    },
    getData: (key: string) => store[key] ?? '',
    dropEffect: '',
    effectAllowed: '',
  }
}

/** Fires a pointer event at a client point (jsdom drops these init fields). */
function firePointer(
  node: Element,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  {
    clientX = 0,
    clientY = 0,
    button = 0,
    shiftKey = false,
  }: { clientX?: number; clientY?: number; button?: number; shiftKey?: boolean } = {},
) {
  const event = createEvent[type](node, { pointerId: 1 })
  Object.defineProperty(event, 'clientX', { get: () => clientX })
  Object.defineProperty(event, 'clientY', { get: () => clientY })
  Object.defineProperty(event, 'button', { get: () => button })
  Object.defineProperty(event, 'shiftKey', { get: () => shiftKey })
  fireEvent(node, event)
}

describe('ReportBuilderScreen — static shell', () => {
  it('renders the four workspace regions', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(screen.getByRole('toolbar', { name: 'Report builder tools' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Insert' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Report canvas' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Properties' })).toBeInTheDocument()
  })

  it('renders the top-bar actions', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    for (const name of ['Undo', 'Redo', 'Preview', 'Save']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('shows which Report Template is open', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(screen.getByText('annual-emissions')).toBeInTheDocument()
    expect(screen.getByText('Template')).toBeInTheDocument()
  })

  it('returns to Reports when the back control is used', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Back to Reports' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('falls back to a placeholder title when no template id is given', () => {
    render(<ReportBuilderScreen templateId={null} onClose={vi.fn()} />)

    expect(screen.getByText('Untitled report template')).toBeInTheDocument()
  })
})

describe('ReportBuilderScreen — canvas & zoom (Phase 2)', () => {
  it('renders the banded report canvas inside the canvas region', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    const canvas = screen.getByRole('region', { name: 'Report canvas' })
    expect(within(canvas).getByRole('group', { name: 'Report Header' })).toBeInTheDocument()
    expect(within(canvas).getByText('Annual Emissions Inventory')).toBeInTheDocument()
  })

  it('starts the canvas at 100% zoom', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Zoom' })).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('zooms in and out through the toolbar controls', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByText('125%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    await user.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('rescales the rendered canvas when the zoom changes', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // The 4in title is 384px wide at 100% and 480px at 125% (96px/in).
    const title = screen.getByText('Annual Emissions Inventory')
    expect(title).toHaveStyle({ width: '384px' })

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(title).toHaveStyle({ width: '480px' })
  })
})

describe('ReportBuilderScreen — selection (Phase 3)', () => {
  it('starts with nothing selected', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(screen.getByText('No selection')).toBeInTheDocument()
  })

  it('selects a clicked element, populating the Properties panel and status bar', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))

    const props = screen.getByRole('complementary', { name: 'Properties' })
    expect(within(props).getByText('Label')).toBeInTheDocument()
    expect(screen.getByText(/Selected: Label/)).toBeInTheDocument()
  })

  it('clears the selection when the empty canvas is clicked', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    expect(screen.getByText(/Selected: Label/)).toBeInTheDocument()

    // Click the band region itself (not an element) to clear the selection.
    await user.click(screen.getByRole('group', { name: 'Report Header' }))

    expect(screen.getByText('No selection')).toBeInTheDocument()
    // With nothing selected, the Properties panel shows page setup (Phase 10).
    const props = screen.getByRole('complementary', { name: 'Properties' })
    expect(within(props).getByText('Page Setup')).toBeInTheDocument()
  })
})

describe('ReportBuilderScreen — editing (Phase 4)', () => {
  it('edits the selected element text and reflects it on the canvas', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Quarterly Report' } })

    const canvas = screen.getByRole('region', { name: 'Report canvas' })
    expect(within(canvas).getByText('Quarterly Report')).toBeInTheDocument()
    expect(within(canvas).queryByText('Annual Emissions Inventory')).not.toBeInTheDocument()
  })

  it('moves the selected element when its X is edited', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    // Move the title to X = 96px (1in); the canvas renders it at left: 96px.
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '96' } })

    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ left: '96px' })
  })

  it('applies a Bold toggle to the selected element on the canvas', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    await user.click(screen.getByRole('button', { name: 'Bold' }))

    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ fontWeight: '700' })
  })

  it('applies a Fill colour change to the selected element on the canvas', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    fireEvent.change(screen.getByLabelText('Fill'), { target: { value: '#ff0000' } })

    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ color: '#ff0000' })
  })
})

describe('ReportBuilderScreen — Insert palette (Phase 5)', () => {
  it('adds a selected element of the chosen type from the desktop palette', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    const palette = within(screen.getByRole('region', { name: 'Insert' }))
    await user.click(palette.getByRole('button', { name: 'Rectangle' }))

    const props = within(screen.getByRole('complementary', { name: 'Properties' }))
    expect(props.getByText('Rectangle')).toBeInTheDocument()
    expect(screen.getByText(/Selected: Rectangle/)).toBeInTheDocument()
  })

  it('inserts into the band of the current selection (the active band)', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Select a data field that lives in the detail band, making detail active.
    await user.click(screen.getByText('{Record.Field}'))
    await user.click(within(screen.getByRole('region', { name: 'Insert' })).getByRole('button', { name: 'Label' }))

    const detail = within(screen.getByRole('group', { name: 'Detail' }))
    expect(detail.getByText('Label')).toBeInTheDocument()
  })

  it('inserts into the first band when nothing is selected', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(within(screen.getByRole('region', { name: 'Insert' })).getByRole('button', { name: 'Label' }))

    const header = within(screen.getByRole('group', { name: 'Report Header' }))
    expect(header.getByText('Label')).toBeInTheDocument()
  })

  it('opens the mobile Insert sheet, filters, and inserts the chosen element', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Insert' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Insert element' }))
    await user.type(dialog.getByRole('searchbox'), 'chart')
    expect(dialog.queryByRole('button', { name: 'Label' })).not.toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Chart' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/Selected: Chart/)).toBeInTheDocument()
  })

  it('dismisses the Insert sheet without inserting when the backdrop is tapped', async () => {
    const user = userEvent.setup()
    const { container } = render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Insert' }))
    expect(screen.getByRole('dialog', { name: 'Insert element' })).toBeInTheDocument()

    await user.click(container.querySelector('.rb-sheet-overlay')!)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('No selection')).toBeInTheDocument()
  })

  it('renders the desktop Insert sidebar as a compact icon rail with tooltips', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    const item = within(screen.getByRole('region', { name: 'Insert' })).getByRole('button', { name: 'Rectangle' })
    expect(item).toHaveAttribute('title', 'Rectangle')
  })

  it('drops a dragged palette item onto a band, placing and selecting it there', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    const item = within(screen.getByRole('region', { name: 'Insert' })).getByRole('button', { name: 'Rectangle' })
    const footer = screen.getByRole('group', { name: 'Page Footer' })

    // Drag from the sidebar and drop on the page-footer band (same DataTransfer).
    const dataTransfer = makeDataTransfer()
    fireEvent.dragStart(item, { dataTransfer })
    const dropEvent = createEvent.drop(footer, { dataTransfer })
    Object.defineProperty(dropEvent, 'clientX', { get: () => 0 })
    Object.defineProperty(dropEvent, 'clientY', { get: () => 0 })
    fireEvent(footer, dropEvent)

    expect(within(footer).getByRole('button', { name: 'Rectangle' })).toBeInTheDocument()
    expect(screen.getByText(/Selected: Rectangle/)).toBeInTheDocument()
  })

  it('moves a placed element when it is dragged on the canvas', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Disable snap so this exercises the raw drag mechanics (snap is on by default
    // from Phase 7; snapping is covered by its own tests).
    fireEvent.click(screen.getByRole('button', { name: 'Snap to grid' }))

    // The title sits at x=0.42in → 40.32px at 100% zoom.
    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ left: '40.32px' })

    const title = screen.getByText('Annual Emissions Inventory')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerMove', { clientX: 96, clientY: 0 }) // drag 1in to the right

    // Now at 1.42in → 136.32px, and selected.
    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ left: '136.32px' })
    expect(screen.getByText(/Selected: Label/)).toBeInTheDocument()
  })

  it('resizes a selected element when a corner handle is dragged', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Disable snap so this exercises the raw resize mechanics (see the move test).
    await user.click(screen.getByRole('button', { name: 'Snap to grid' }))

    // Select the title (4in wide → 384px at 100%); its resize handles appear.
    await user.click(screen.getByText('Annual Emissions Inventory'))
    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ width: '384px' })

    const se = screen.getByRole('button', { name: 'Resize bottom-right' })
    firePointer(se, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(se, 'pointerMove', { clientX: 96, clientY: 0 }) // widen by 1in

    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ width: '480px' }) // 5in
  })
})

describe('ReportBuilderScreen — snap to grid (Phase 7)', () => {
  it('starts with snap-to-grid on, shown in the status bar', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(screen.getByText('Snap: On · Grid 12px')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snap to grid' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles snap-to-grid off and on from the toolbar', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: 'Snap to grid' })

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Snap: Off')).toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Snap: On · Grid 12px')).toBeInTheDocument()
  })

  it('changes the grid size from the toolbar', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Grid size' }), '24')

    expect(screen.getByText('Snap: On · Grid 24px')).toBeInTheDocument()
  })

  it('snaps a dragged element to the grid', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Title sits at x=0.42in. Drag right by 0.3125in (30px); with snap on (0.125in
    // grid) 0.42+0.3125=0.7325in snaps to 0.75in → 72px.
    const title = screen.getByText('Annual Emissions Inventory')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerMove', { clientX: 30, clientY: 0 })

    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ left: '72px' })
  })
})

describe('ReportBuilderScreen — multi-select & align (Phase 8)', () => {
  /** The rendered `left` of a canvas element, in pixels. */
  const leftPxOf = (text: string) => parseFloat((screen.getByText(text) as HTMLElement).style.left)

  /** Scopes a query to the canvas region (the Insert palette shares some names). */
  const canvas = () => within(screen.getByRole('region', { name: 'Report canvas' }))

  it('builds a multi-selection with shift-click, summarised in the panels', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    firePointer(screen.getByText('Annual Emissions Inventory'), 'pointerDown')
    firePointer(canvas().getByRole('button', { name: 'Image' }), 'pointerDown', { shiftKey: true })

    expect(screen.getByText('Selected: 2 elements')).toBeInTheDocument()
    const props = within(screen.getByRole('complementary', { name: 'Properties' }))
    expect(props.getByText(/2 elements selected/i)).toBeInTheDocument()
  })

  it('replaces a multi-selection with a single element on a plain click', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    firePointer(screen.getByText('Annual Emissions Inventory'), 'pointerDown')
    firePointer(canvas().getByRole('button', { name: 'Image' }), 'pointerDown', { shiftKey: true })
    expect(screen.getByText('Selected: 2 elements')).toBeInTheDocument()

    // A plain (non-additive) press collapses the selection to just that element.
    firePointer(screen.getByText('Annual Emissions Inventory'), 'pointerDown')

    expect(screen.getByText(/Selected: Label/)).toBeInTheDocument()
  })

  it('aligns selected elements to a shared left edge across bands', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Title (report header, x=0.42in) + a detail data field (x=3.6in); their
    // shared min X is 0.42in → 40.32px. Alignment lines the column up across bands.
    firePointer(screen.getByText('Annual Emissions Inventory'), 'pointerDown')
    firePointer(screen.getByText('{Record.Tons}'), 'pointerDown', { shiftKey: true })

    fireEvent.click(screen.getByRole('button', { name: 'Align left' }))

    expect(screen.getByText('{Record.Tons}')).toHaveStyle({ left: '40.32px' })
    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ left: '40.32px' })
  })

  it('distributes three selected elements with equal horizontal gaps', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // The three detail columns: x=0.42 (w2), 3.6 (w1.2), 5.4 (w1.2). Distributing
    // keeps the extremes and gives the middle x=3.31in → 317.76px.
    firePointer(screen.getByText('{Record.Field}'), 'pointerDown')
    firePointer(screen.getByText('{Record.Tons}'), 'pointerDown', { shiftKey: true })
    firePointer(screen.getByText('{Record.Limit}'), 'pointerDown', { shiftKey: true })

    fireEvent.click(screen.getByRole('button', { name: 'Distribute horizontally' }))

    expect(leftPxOf('{Record.Tons}')).toBeCloseTo(317.76, 2)
    expect(leftPxOf('{Record.Field}')).toBeCloseTo(40.32, 2) // first extreme stays
    expect(leftPxOf('{Record.Limit}')).toBeCloseTo(518.4, 2) // last extreme stays (5.4in)
  })

  it('enables the alignment tools only when enough elements are selected', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Nothing selected: both align and distribute are unavailable.
    expect(screen.getByRole('button', { name: 'Align left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Distribute horizontally' })).toBeDisabled()

    // Two selected: align is available, distribute still needs a third.
    firePointer(screen.getByText('Annual Emissions Inventory'), 'pointerDown')
    firePointer(screen.getByText('{Record.Tons}'), 'pointerDown', { shiftKey: true })

    expect(screen.getByRole('button', { name: 'Align left' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Distribute horizontally' })).toBeDisabled()
  })

  it('gives every Arrange button a hover tooltip matching its label', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    const arrangeLabels = [
      'Align left',
      'Align center',
      'Align right',
      'Align top',
      'Align middle',
      'Align bottom',
      'Distribute horizontally',
      'Distribute vertically',
    ]
    for (const label of arrangeLabels) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('title', label)
    }
  })
})

describe('ReportBuilderScreen — marquee select (Phase 8b)', () => {
  it('selects the elements a rubber-band drag covers, summarised by count', () => {
    const { container } = render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)
    const page = container.querySelector('.rb-page')!

    // The report header holds the title (abs ~40..424px, 42..75px) and subtitle
    // (~40..501px, 91..115px). A band over both — and short of the page header
    // (top 144px) — selects exactly those two across the band's height.
    firePointer(page, 'pointerDown', { clientX: 10, clientY: 30 })
    firePointer(page, 'pointerMove', { clientX: 500, clientY: 130 })
    firePointer(page, 'pointerUp', { clientX: 500, clientY: 130 })

    expect(screen.getByText('Selected: 2 elements')).toBeInTheDocument()
  })

  it('clears the selection when a marquee drag covers nothing', () => {
    const { container } = render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)
    const page = container.querySelector('.rb-page')!

    // First select something, then rubber-band an empty region to clear it. The
    // sub-report band's frame ends at ~684px, so the far right of that band is empty.
    firePointer(screen.getByText('Annual Emissions Inventory'), 'pointerDown')
    expect(screen.getByText(/Selected: Label/)).toBeInTheDocument()

    firePointer(page, 'pointerDown', { clientX: 700, clientY: 215 })
    firePointer(page, 'pointerMove', { clientX: 790, clientY: 260 })
    firePointer(page, 'pointerUp', { clientX: 790, clientY: 260 })

    expect(screen.getByText('No selection')).toBeInTheDocument()
  })
})

describe('ReportBuilderScreen — delete element', () => {
  /** Scopes a query to the canvas region (the Insert palette shares some names). */
  const canvas = () => within(screen.getByRole('region', { name: 'Report canvas' }))

  it('disables Delete when nothing is selected', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('deletes the selected element from the canvas and clears the selection', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    expect(screen.getByText(/Selected: Label/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(canvas().queryByText('Annual Emissions Inventory')).not.toBeInTheDocument()
    expect(screen.getByText('No selection')).toBeInTheDocument()
  })

  it('deletes every element in a multi-selection', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    firePointer(screen.getByText('{Record.Field}'), 'pointerDown')
    firePointer(screen.getByText('{Record.Tons}'), 'pointerDown', { shiftKey: true })
    expect(screen.getByText('Selected: 2 elements')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(canvas().queryByText('{Record.Field}')).not.toBeInTheDocument()
    expect(canvas().queryByText('{Record.Tons}')).not.toBeInTheDocument()
    expect(screen.getByText('No selection')).toBeInTheDocument()
  })

  it('deletes the selection with the Delete key', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    fireEvent.keyDown(screen.getByText('Annual Emissions Inventory'), { key: 'Delete' })

    expect(canvas().queryByText('Annual Emissions Inventory')).not.toBeInTheDocument()
  })

  it('does not delete while editing a property field (Backspace in an input)', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    fireEvent.keyDown(screen.getByLabelText('Text'), { key: 'Backspace' })

    // Backspace inside a form field must edit the text, not delete the element.
    expect(canvas().getByText('Annual Emissions Inventory')).toBeInTheDocument()
  })

  it('leaves the selection alone for keys other than Delete/Backspace', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    fireEvent.keyDown(screen.getByText('Annual Emissions Inventory'), { key: 'a' })

    expect(canvas().getByText('Annual Emissions Inventory')).toBeInTheDocument()
  })

  it('does nothing on Delete when nothing is selected', () => {
    const { container } = render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    fireEvent.keyDown(container.querySelector('.rb')!, { key: 'Delete' })

    expect(screen.getByText('No selection')).toBeInTheDocument()
    expect(canvas().getByText('Annual Emissions Inventory')).toBeInTheDocument()
  })
})

describe('ReportBuilderScreen — inline text editing', () => {
  const canvas = () => within(screen.getByRole('region', { name: 'Report canvas' }))

  it('edits an element text inline on the canvas via double-click', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.dblClick(screen.getByText('Annual Emissions Inventory'))
    const editor = screen.getByRole('textbox', { name: 'Edit text' })
    fireEvent.change(editor, { target: { value: 'Quarterly Report' } })
    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(canvas().getByText('Quarterly Report')).toBeInTheDocument()
    expect(canvas().queryByText('Annual Emissions Inventory')).not.toBeInTheDocument()
  })

  it('keeps the Properties Text field in sync with an inline edit', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.dblClick(screen.getByText('Annual Emissions Inventory'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit text' }), { target: { value: 'Quarterly Report' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit text' }), { key: 'Enter' })

    expect(screen.getByLabelText('Text')).toHaveValue('Quarterly Report')
  })
})

describe('ReportBuilderScreen — multiple pages & page setup (Phase 10)', () => {
  /** Scopes a query to the Insert palette region. */
  const palette = () => within(screen.getByRole('region', { name: 'Insert' }))

  /** Inserts a Page Break from the desktop palette (nothing selected → first band). */
  const insertPageBreak = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(palette().getByRole('button', { name: 'Page Break' }))

  it('has a page navigator in the toolbar, disabled for a single-page document', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument() // status bar
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('counts a page break as an extra page in the status bar', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await insertPageBreak(user)

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  })

  it('switches the current page with the navigator', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await insertPageBreak(user) // now two pages

    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
  })

  it('clamps the current page back into range when a page break is removed', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await insertPageBreak(user) // two pages; the new break is selected
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()

    // Deleting the page break drops the document to one page; page 2 no longer exists.
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('shows page setup in the Properties panel when nothing is selected', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    const props = within(screen.getByRole('complementary', { name: 'Properties' }))
    expect(props.getByText('Page Setup')).toBeInTheDocument()
    expect(props.getByRole('combobox', { name: 'Page size' })).toHaveValue('letter')
  })

  it('rotates the page to landscape, widening the canvas', async () => {
    const user = userEvent.setup()
    const { container } = render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Portrait US Letter: page is 8.5in → 816px wide at 100% zoom.
    expect(container.querySelector('.rb-page')).toHaveStyle({ width: '816px' })

    await user.click(screen.getByRole('button', { name: 'Landscape' }))

    // Landscape: 11in → 1056px wide.
    expect(container.querySelector('.rb-page')).toHaveStyle({ width: '1056px' })
  })

  it('resizes the page by dragging its edge handle', () => {
    const { container } = render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Sample is US Letter (8.5in → 816px wide at 100%).
    expect(container.querySelector('.rb-page')).toHaveStyle({ width: '816px' })

    const handle = screen.getByRole('button', { name: 'Resize page width' })
    firePointer(handle, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(handle, 'pointerMove', { clientX: 96, clientY: 0 }) // drag the right edge +1in

    // Now 9.5in → 912px, and the size becomes Custom in the Page Setup panel.
    expect(container.querySelector('.rb-page')).toHaveStyle({ width: '912px' })
    expect(screen.getByRole('combobox', { name: 'Page size' })).toHaveValue('custom')
  })
})

describe('ReportBuilderScreen — undo/redo (Phase 12)', () => {
  /** Scopes a query to the canvas region. */
  const canvas = () => within(screen.getByRole('region', { name: 'Report canvas' }))

  it('disables Undo and Redo when there is no edit history', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('undoes an edit and then redoes it on the canvas', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Quarterly Report' } })
    expect(canvas().getByText('Quarterly Report')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(canvas().getByText('Annual Emissions Inventory')).toBeInTheDocument()
    expect(canvas().queryByText('Quarterly Report')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(canvas().getByText('Quarterly Report')).toBeInTheDocument()
  })

  it('undoes a delete, bringing the element back', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(canvas().queryByText('Annual Emissions Inventory')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(canvas().getByText('Annual Emissions Inventory')).toBeInTheDocument()
  })

  it('collapses one drag gesture into a single undo step', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Snap to grid' })) // raw (unsnapped) drag

    const title = screen.getByText('Annual Emissions Inventory')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerMove', { clientX: 48, clientY: 0 }) // +0.5in
    firePointer(title, 'pointerMove', { clientX: 96, clientY: 0 }) // +1in total
    firePointer(title, 'pointerUp', { clientX: 96, clientY: 0 })
    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ left: '136.32px' })

    // One undo reverts the whole gesture, not just the last move event.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByText('Annual Emissions Inventory')).toHaveStyle({ left: '40.32px' })
  })
})

describe('ReportBuilderScreen — save (Phase 12)', () => {
  it('saves the current template as RDL named after it', async () => {
    const user = userEvent.setup()
    const downloadSpy = vi.spyOn(downloadModule, 'downloadText').mockImplementation(() => {})
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(downloadSpy).toHaveBeenCalledWith(
      'Annual Emissions Inventory.rdl',
      toRdl(createSampleTemplate('annual-emissions')),
      'application/xml',
    )
    downloadSpy.mockRestore()
  })

  it('saves the edited template, reflecting an on-canvas change', async () => {
    const user = userEvent.setup()
    const downloadSpy = vi.spyOn(downloadModule, 'downloadText').mockImplementation(() => {})
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Quarterly Report' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const xml = downloadSpy.mock.calls[0][1]
    expect(xml).toContain('Quarterly Report')
    expect(xml).not.toContain('<Value>Annual Emissions Inventory</Value>')
    downloadSpy.mockRestore()
  })
})

describe('ReportBuilderScreen — live preview (Phase 13)', () => {
  it('opens the live preview for this template in a new tab', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Live preview' }))

    expect(openSpy).toHaveBeenCalledOnce()
    expect(openSpy.mock.calls[0][0]).toContain('#/report-preview/')
    expect(openSpy.mock.calls[0][1]).toBe('_blank')
    openSpy.mockRestore()
  })
})

describe('ReportBuilderScreen — live collaboration (Phase B)', () => {
  /** A fake collaboration hub that captures the presence handler so a test can drive it. */
  function fakeBuilderHub() {
    let participants: ((sid: string, ps: PreviewParticipant[]) => void) | null = null
    const hub: PreviewHub = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      join: vi.fn(async () => {}),
      pushRdl: vi.fn(async () => {}),
      updateSelection: vi.fn(async () => {}),
      claimElement: vi.fn(async () => null),
      releaseElement: vi.fn(async () => {}),
      onFrames: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
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
      emitParticipants: (sid: string, ps: PreviewParticipant[]) => act(() => participants?.(sid, ps)),
    }
  }

  it('claims the selected element and publishes the selection to collaborators', async () => {
    const user = userEvent.setup()
    const { hub } = fakeBuilderHub()
    render(
      <ReportBuilderScreen
        templateId="annual-emissions"
        accessToken="tok"
        createHub={() => hub}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByText('Annual Emissions Inventory')) // the title element, id "title"

    await waitFor(() => expect(hub.claimElement).toHaveBeenCalledWith('title'))
    await waitFor(() => expect(hub.updateSelection).toHaveBeenCalledWith(['title']))
  })

  it("overlays a collaborator's live selection on the canvas", async () => {
    const { hub, emitParticipants } = fakeBuilderHub()
    render(
      <ReportBuilderScreen
        templateId="annual-emissions"
        accessToken="tok"
        createHub={() => hub}
        onClose={vi.fn()}
      />,
    )
    await waitFor(() => expect(hub.join).toHaveBeenCalledWith('annual-emissions'))

    emitParticipants('annual-emissions', [
      { connectionId: 'conn-2', userId: 'u2', displayName: 'Grace', color: '#2563eb', selectedElementIds: ['title'] },
    ])

    expect(screen.getByText('Grace')).toBeInTheDocument()
  })
})

describe('ReportBuilderScreen — preview (Phase 12)', () => {
  it('opens a preview that resolves bindings and the page number', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // The canvas shows binding tokens verbatim before previewing.
    const canvas = within(screen.getByRole('region', { name: 'Report canvas' }))
    expect(canvas.getByText('{Record.Field}')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Preview' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Report preview' }))
    expect(dialog.getByText('Goshen Asphalt Plant')).toBeInTheDocument() // {Facility.Name} resolved
    expect(dialog.getByText('Page 1 of 1')).toBeInTheDocument() // page-number tokens resolved
  })

  it('closes the preview', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('dialog', { name: 'Report preview' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog', { name: 'Report preview' })).not.toBeInTheDocument()
  })

  it('previews edits made on the canvas', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    await user.click(screen.getByText('Annual Emissions Inventory'))
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Quarterly Report' } })
    await user.click(screen.getByRole('button', { name: 'Preview' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Report preview' }))
    expect(dialog.getByText('Quarterly Report')).toBeInTheDocument()
  })
})

describe('ReportBuilderScreen — page-number options (Phase 11)', () => {
  /** Scopes a query to the canvas region (the Properties panel echoes some text). */
  const canvas = () => within(screen.getByRole('region', { name: 'Report canvas' }))

  it('renders the footer page number on the canvas by default', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    expect(canvas().getByText('Page {n} of {N}')).toBeInTheDocument()
  })

  it('hides the footer page number when it is toggled off in Page Setup', async () => {
    const user = userEvent.setup()
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    // Nothing is selected, so the Page Setup panel (with its Page Numbers controls) shows.
    await user.click(screen.getByRole('button', { name: 'Show page numbers' }))

    expect(canvas().queryByText('Page {n} of {N}')).not.toBeInTheDocument()
  })

  it('updates the footer page number when the format is edited', () => {
    render(<ReportBuilderScreen templateId="annual-emissions" onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'Sheet {n}' } })

    expect(canvas().getByText('Sheet {n}')).toBeInTheDocument()
    expect(canvas().queryByText('Page {n} of {N}')).not.toBeInTheDocument()
  })
})
