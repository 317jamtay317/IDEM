import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent, createEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportCanvas } from './ReportCanvas'
import { BAND_LABELS } from './bandLabels'
import { ELEMENT_DRAG_MIME } from './dnd'
import { createElement, createEmptyTemplate, type ReportTemplate } from './model'

/** A minimal stand-in for the browser DataTransfer used in drag events. */
function makeDataTransfer(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    setData: (key: string, value: string) => {
      store[key] = value
    },
    getData: (key: string) => store[key] ?? '',
    dropEffect: '',
    effectAllowed: '',
  }
}

/**
 * Fires a drop of `type` at the given client point. jsdom does not carry
 * clientX/clientY from a `fireEvent.drop` init, so the coordinates are defined
 * on the event explicitly.
 */
function fireDropAt(node: Element, type: string, clientX: number, clientY: number) {
  const dataTransfer = makeDataTransfer({ [ELEMENT_DRAG_MIME]: type })
  const event = createEvent.drop(node, { dataTransfer })
  Object.defineProperty(event, 'clientX', { get: () => clientX })
  Object.defineProperty(event, 'clientY', { get: () => clientY })
  fireEvent(node, event)
}

/** Fires a pointer event at a client point (jsdom drops these init fields too). */
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

/** A small template with one element per exercised band and clean-pixel rects. */
function fixture(): ReportTemplate {
  const t = createEmptyTemplate('t1', 'Test Template')
  const band = (kind: string) => t.bands.find((b) => b.kind === kind)!

  band('reportHeader').elements.push({
    id: 'title',
    type: 'label',
    rect: { x: 1, y: 0.5, w: 3, h: 0.25 },
    text: 'Hello Report',
  })
  band('detail').elements.push({
    id: 'tons',
    type: 'dataField',
    rect: { x: 2, y: 0, w: 1, h: 0.25 },
    text: '{Record.Tons}',
    expression: '{Record.Tons}',
  })
  band('pageFooter').elements.push({
    id: 'logo',
    type: 'image',
    rect: { x: 0, y: 0, w: 1, h: 0.5 },
  })

  return t
}

describe('ReportCanvas — footer page numbers (Phase 11)', () => {
  it('renders the page-number format in the page footer when shown', () => {
    render(<ReportCanvas template={fixture()} zoom={100} />)

    const footer = screen.getByRole('group', { name: BAND_LABELS.pageFooter })
    expect(within(footer).getByText('Page {n} of {N}')).toBeInTheDocument()
  })

  it('shows the page-number tokens verbatim (resolved only at preview time)', () => {
    const t = fixture()
    t.pageNumbers = { ...t.pageNumbers, format: '{n} / {N}' }
    render(<ReportCanvas template={t} zoom={100} />)

    expect(screen.getByText('{n} / {N}')).toBeInTheDocument()
  })

  it('hides the footer page number when the option is turned off', () => {
    const t = fixture()
    t.pageNumbers = { ...t.pageNumbers, show: false }
    render(<ReportCanvas template={t} zoom={100} />)

    expect(screen.queryByText('Page {n} of {N}')).not.toBeInTheDocument()
  })

  it('aligns the page number to its configured footer position', () => {
    const t = fixture()
    t.pageNumbers = { ...t.pageNumbers, position: 'left' }
    render(<ReportCanvas template={t} zoom={100} />)

    expect(screen.getByText('Page {n} of {N}')).toHaveStyle({ textAlign: 'left' })
  })
})

describe('ReportCanvas', () => {
  it('renders all five bands as labelled regions', () => {
    render(<ReportCanvas template={fixture()} zoom={100} />)

    for (const label of Object.values(BAND_LABELS)) {
      expect(screen.getByRole('group', { name: label })).toBeInTheDocument()
    }
  })

  it('renders a label element with its literal text', () => {
    render(<ReportCanvas template={fixture()} zoom={100} />)

    expect(screen.getByText('Hello Report')).toBeInTheDocument()
  })

  it('renders a binding token as literal text (resolved only at preview time)', () => {
    render(<ReportCanvas template={fixture()} zoom={100} />)

    expect(screen.getByText('{Record.Tons}')).toBeInTheDocument()
  })

  it('falls back to the expression when a data element has no display text', () => {
    const t = createEmptyTemplate('t1', 'T1')
    t.bands
      .find((b) => b.kind === 'detail')!
      .elements.push({ id: 'f', type: 'dataField', rect: { x: 0, y: 0, w: 1, h: 0.25 }, expression: '=Sum(Tons)' })
    render(<ReportCanvas template={t} zoom={100} />)

    expect(screen.getByText('=Sum(Tons)')).toBeInTheDocument()
  })

  it('applies element styling to the rendered text', () => {
    const t = createEmptyTemplate('t1', 'T1')
    t.bands.find((b) => b.kind === 'reportHeader')!.elements.push({
      id: 'styled',
      type: 'label',
      rect: { x: 0, y: 0, w: 3, h: 0.3 },
      text: 'Styled',
      style: { fontSize: 12, fontWeight: 'bold', align: 'center', color: '#0F172A' },
    })
    render(<ReportCanvas template={t} zoom={100} />)

    expect(screen.getByText('Styled')).toHaveStyle({
      fontSize: '16px', // 12pt at 100%
      fontWeight: '700',
      textAlign: 'center',
      color: '#0F172A',
    })
  })

  it('places an element at its inch position, converted to pixels at 100% zoom', () => {
    render(<ReportCanvas template={fixture()} zoom={100} />)

    // x=1in, y=0.5in, w=3in, h=0.25in at 96px/in.
    expect(screen.getByText('Hello Report')).toHaveStyle({
      left: '96px',
      top: '48px',
      width: '288px',
      height: '24px',
    })
  })

  it('scales element geometry with the zoom level', () => {
    const { rerender } = render(<ReportCanvas template={fixture()} zoom={100} />)
    expect(screen.getByText('Hello Report')).toHaveStyle({ left: '96px', width: '288px' })

    rerender(<ReportCanvas template={fixture()} zoom={200} />)
    expect(screen.getByText('Hello Report')).toHaveStyle({ left: '192px', width: '576px' })
  })

  it('scales the page surface width with the zoom level', () => {
    const { container } = render(<ReportCanvas template={fixture()} zoom={100} />)

    // US Letter width 8.5in × 96px/in = 816px.
    expect(container.querySelector('.rb-page')).toHaveStyle({ width: '816px' })
  })

  it('places each element inside its own band', () => {
    render(<ReportCanvas template={fixture()} zoom={100} />)

    const detail = screen.getByRole('group', { name: BAND_LABELS.detail })
    expect(within(detail).getByText('{Record.Tons}')).toBeInTheDocument()
    expect(within(detail).queryByText('Hello Report')).not.toBeInTheDocument()
  })
})

describe('ReportCanvas — selection', () => {
  it('reports the element id (non-additive) when an element is clicked', async () => {
    const onSelectElement = vi.fn()
    const user = userEvent.setup()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} />)

    await user.click(screen.getByText('Hello Report'))

    expect(onSelectElement).toHaveBeenCalledWith('title', false)
  })

  it('marks the selected element as pressed and others as not', () => {
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} />)

    expect(screen.getByText('Hello Report')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('{Record.Tons}')).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks every element of a multi-selection as pressed', () => {
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title', 'tons']} />)

    expect(screen.getByText('Hello Report')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('{Record.Tons}')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Image' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports an additive selection when an element is shift-clicked', () => {
    const onSelectElement = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} />)

    firePointer(screen.getByText('Hello Report'), 'pointerDown', { shiftKey: true })

    expect(onSelectElement).toHaveBeenCalledWith('title', true)
  })

  it('selects on keyboard activation (a click with no preceding pointer press)', () => {
    const onSelectElement = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} />)

    // A keyboard-driven click has detail 0; pointer-driven selection is covered
    // separately. fireEvent.click dispatches only the click (no pointer press).
    fireEvent.click(screen.getByText('Hello Report'))

    expect(onSelectElement).toHaveBeenCalledWith('title', false)
  })

  it('does not start a drag on a shift (additive) press', () => {
    const onSelectElement = vi.fn()
    const onMoveElement = vi.fn()
    render(
      <ReportCanvas
        template={fixture()}
        zoom={100}
        onSelectElement={onSelectElement}
        onMoveElement={onMoveElement}
      />,
    )

    const title = screen.getByText('Hello Report')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0, shiftKey: true })
    firePointer(title, 'pointerMove', { clientX: 96, clientY: 0 })

    expect(onMoveElement).not.toHaveBeenCalled()
  })

  it('deselects when the empty canvas is clicked', async () => {
    const onSelectElement = vi.fn()
    const user = userEvent.setup()
    render(
      <ReportCanvas
        template={fixture()}
        zoom={100}
        selectedIds={['title']}
        onSelectElement={onSelectElement}
      />,
    )

    // The Page Header band is empty in the fixture — clicking it is a canvas click.
    await user.click(screen.getByRole('group', { name: BAND_LABELS.pageHeader }))

    expect(onSelectElement).toHaveBeenCalledWith(null, false)
  })

  it('labels shape elements that have no text so they are still selectable', () => {
    render(<ReportCanvas template={fixture()} zoom={100} />)

    // The image element renders an "Image" placeholder as its accessible name.
    expect(screen.getByRole('button', { name: 'Image' })).toBeInTheDocument()
  })
})

describe('ReportCanvas — palette element types', () => {
  /** A template with the given element types placed in the detail band. */
  function withDetailTypes(...types: Parameters<typeof createElement>[0][]): ReportTemplate {
    const t = createEmptyTemplate('t1', 'T1')
    const detail = t.bands.find((b) => b.kind === 'detail')!
    types.forEach((type) => detail.elements.push(createElement(type, `${type}-1`)))
    return t
  }

  it('renders advanced container types as labelled placeholder blocks', () => {
    render(<ReportCanvas template={withDetailTypes('table', 'chart', 'subReport')} zoom={100} />)

    // Scope to the detail band: "Sub Report" also names the sub-report band tab.
    const detail = within(screen.getByRole('group', { name: BAND_LABELS.detail }))
    expect(detail.getByText('Table')).toBeInTheDocument()
    expect(detail.getByText('Chart')).toBeInTheDocument()
    expect(detail.getByText('Sub Report')).toBeInTheDocument()
  })

  it('draws textless shape types but still labels them for selection', () => {
    render(<ReportCanvas template={withDetailTypes('triangle', 'ellipse')} zoom={100} />)

    expect(screen.getByRole('button', { name: 'Triangle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ellipse' })).toBeInTheDocument()
  })
})

describe('ReportCanvas — drag and drop', () => {
  it('inserts the dropped type at the drop position in the dropped band', () => {
    const onInsertAt = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onInsertAt={onInsertAt} />)

    const detail = screen.getByRole('group', { name: BAND_LABELS.detail })
    // jsdom band rect is at (0,0), so the client point maps straight to inches.
    fireDropAt(detail, 'table', 96, 48)

    expect(onInsertAt).toHaveBeenCalledWith('table', 'detail', { x: 1, y: 0.5 })
  })

  it('scales the drop position by the zoom level', () => {
    const onInsertAt = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={200} onInsertAt={onInsertAt} />)

    const detail = screen.getByRole('group', { name: BAND_LABELS.detail })
    fireDropAt(detail, 'label', 192, 96)

    expect(onInsertAt).toHaveBeenCalledWith('label', 'detail', { x: 1, y: 0.5 })
  })

  it('enables dropping by preventing the dragover default', () => {
    render(<ReportCanvas template={fixture()} zoom={100} onInsertAt={vi.fn()} />)

    const detail = screen.getByRole('group', { name: BAND_LABELS.detail })
    const notCancelled = fireEvent.dragOver(detail, { dataTransfer: makeDataTransfer() })

    expect(notCancelled).toBe(false) // preventDefault was called
  })

  it('ignores a drop whose payload is not a known element type', () => {
    const onInsertAt = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onInsertAt={onInsertAt} />)

    const detail = screen.getByRole('group', { name: BAND_LABELS.detail })
    fireEvent.drop(detail, {
      dataTransfer: makeDataTransfer({ [ELEMENT_DRAG_MIME]: 'bogus' }),
      clientX: 10,
      clientY: 10,
    })

    expect(onInsertAt).not.toHaveBeenCalled()
  })
})

describe('ReportCanvas — move', () => {
  it('selects an element on pointer down', () => {
    const onSelectElement = vi.fn()
    render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} onMoveElement={vi.fn()} />,
    )

    firePointer(screen.getByText('Hello Report'), 'pointerDown', { clientX: 0, clientY: 0 })

    expect(onSelectElement).toHaveBeenCalledWith('title', false)
  })

  it('reports a new position as the element is dragged', () => {
    const onMoveElement = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onMoveElement={onMoveElement} />)

    const title = screen.getByText('Hello Report') // starts at x=1in, y=0.5in
    firePointer(title, 'pointerDown', { clientX: 10, clientY: 10 })
    firePointer(title, 'pointerMove', { clientX: 106, clientY: 58 }) // +96px, +48px → +1in, +0.5in

    expect(onMoveElement).toHaveBeenLastCalledWith('title', { x: 2, y: 1 })
  })

  it('does not report movement before a drag has started', () => {
    const onMoveElement = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onMoveElement={onMoveElement} />)

    firePointer(screen.getByText('Hello Report'), 'pointerMove', { clientX: 50, clientY: 50 })

    expect(onMoveElement).not.toHaveBeenCalled()
  })

  it('stops reporting movement once the pointer is released', () => {
    const onMoveElement = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onMoveElement={onMoveElement} />)

    const title = screen.getByText('Hello Report')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerUp', { clientX: 0, clientY: 0 })
    onMoveElement.mockClear()
    firePointer(title, 'pointerMove', { clientX: 96, clientY: 0 })

    expect(onMoveElement).not.toHaveBeenCalled()
  })

  it('does not start a drag on a non-primary (e.g. right) button', () => {
    const onMoveElement = vi.fn()
    const onSelectElement = vi.fn()
    render(
      <ReportCanvas template={fixture()} zoom={100} onMoveElement={onMoveElement} onSelectElement={onSelectElement} />,
    )

    const title = screen.getByText('Hello Report')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0, button: 2 })
    firePointer(title, 'pointerMove', { clientX: 96, clientY: 0 })

    expect(onMoveElement).not.toHaveBeenCalled()
    expect(onSelectElement).not.toHaveBeenCalled()
  })

  it('ignores a pointer up when no drag is in progress', () => {
    const onMoveElement = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onMoveElement={onMoveElement} />)

    expect(() => firePointer(screen.getByText('Hello Report'), 'pointerUp')).not.toThrow()
    expect(onMoveElement).not.toHaveBeenCalled()
  })

  it('snaps the dragged position to the grid when snap-to-grid is on', () => {
    const onMoveElement = vi.fn()
    // The fixture's template enables snapping with an eighth-inch (12px) grid.
    render(<ReportCanvas template={fixture()} zoom={100} onMoveElement={onMoveElement} />)

    const title = screen.getByText('Hello Report') // starts at x=1in, y=0.5in
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerMove', { clientX: 30, clientY: 30 }) // +0.3125in each → snapped to grid

    expect(onMoveElement).toHaveBeenLastCalledWith('title', { x: 1.375, y: 0.875 })
  })

  it('does not snap the dragged position when snap-to-grid is off', () => {
    const onMoveElement = vi.fn()
    const t = fixture()
    t.settings.snapToGrid = false
    render(<ReportCanvas template={t} zoom={100} onMoveElement={onMoveElement} />)

    const title = screen.getByText('Hello Report')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerMove', { clientX: 30, clientY: 30 })

    expect(onMoveElement).toHaveBeenLastCalledWith('title', { x: 1.3125, y: 0.8125 })
  })
})

describe('ReportCanvas — grid overlay', () => {
  it('shows the grid overlay when snap-to-grid is enabled', () => {
    const { container } = render(<ReportCanvas template={fixture()} zoom={100} />)

    expect(container.querySelector('.rb-page')).toHaveClass('rb-page-grid')
  })

  it('hides the grid overlay when snap-to-grid is disabled', () => {
    const t = fixture()
    t.settings.snapToGrid = false
    const { container } = render(<ReportCanvas template={t} zoom={100} />)

    expect(container.querySelector('.rb-page')).not.toHaveClass('rb-page-grid')
  })

  it('sizes the grid overlay to the grid spacing in pixels at the current zoom', () => {
    const { container } = render(<ReportCanvas template={fixture()} zoom={100} />)

    // 0.125in × 96px/in = 12px cells.
    expect(container.querySelector('.rb-page')).toHaveStyle({ backgroundSize: '12px 12px' })
  })
})

describe('ReportCanvas — resize', () => {
  it('shows four corner handles on the selected element', () => {
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} onResize={vi.fn()} />)

    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      expect(screen.getByRole('button', { name: `Resize ${corner}` })).toBeInTheDocument()
    }
  })

  it('shows no resize handles when nothing is selected', () => {
    render(<ReportCanvas template={fixture()} zoom={100} onResize={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Resize/ })).not.toBeInTheDocument()
  })

  it('shows no resize handles while several elements are selected', () => {
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title', 'tons']} onResize={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Resize/ })).not.toBeInTheDocument()
  })

  it('resizes from a corner handle as it is dragged', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} onResize={onResize} />)

    // title rect = {x:1, y:0.5, w:3, h:0.25}; drag SE by +96px,+48px → +1in,+0.5in.
    const se = screen.getByRole('button', { name: 'Resize bottom-right' })
    firePointer(se, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(se, 'pointerMove', { clientX: 96, clientY: 48 })

    expect(onResize).toHaveBeenLastCalledWith('title', { x: 1, y: 0.5, w: 4, h: 0.75 })
  })

  it('does not start a resize on a non-primary button', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} onResize={onResize} />)

    const se = screen.getByRole('button', { name: 'Resize bottom-right' })
    firePointer(se, 'pointerDown', { clientX: 0, clientY: 0, button: 2 })
    firePointer(se, 'pointerMove', { clientX: 96, clientY: 48 })

    expect(onResize).not.toHaveBeenCalled()
  })

  it('does not resize before a handle drag has started', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} onResize={onResize} />)

    firePointer(screen.getByRole('button', { name: 'Resize bottom-right' }), 'pointerMove', { clientX: 96, clientY: 48 })

    expect(onResize).not.toHaveBeenCalled()
  })

  it('ignores a handle pointer up when no resize is in progress', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} onResize={onResize} />)

    expect(() => firePointer(screen.getByRole('button', { name: 'Resize bottom-right' }), 'pointerUp')).not.toThrow()
    expect(onResize).not.toHaveBeenCalled()
  })

  it('stops resizing once the pointer is released', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} onResize={onResize} />)

    const se = screen.getByRole('button', { name: 'Resize bottom-right' })
    firePointer(se, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(se, 'pointerUp', { clientX: 0, clientY: 0 })
    onResize.mockClear()
    firePointer(se, 'pointerMove', { clientX: 96, clientY: 48 })

    expect(onResize).not.toHaveBeenCalled()
  })

  it('keeps the selection when a resize handle is clicked', () => {
    const onSelectElement = vi.fn()
    render(
      <ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} onSelectElement={onSelectElement} onResize={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resize bottom-right' }))

    expect(onSelectElement).not.toHaveBeenCalled() // the handle swallows the click; no deselect
  })

  it('snaps a resized edge to the grid when snap-to-grid is on', () => {
    const onResize = vi.fn()
    // Fixture snaps to a 0.125in grid; title rect = {x:1, y:0.5, w:3, h:0.25}.
    render(<ReportCanvas template={fixture()} zoom={100} selectedIds={['title']} onResize={onResize} />)

    const se = screen.getByRole('button', { name: 'Resize bottom-right' })
    firePointer(se, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(se, 'pointerMove', { clientX: 30, clientY: 30 }) // +0.3125in: right→4.375, bottom→1.125

    expect(onResize).toHaveBeenLastCalledWith('title', { x: 1, y: 0.5, w: 3.375, h: 0.625 })
  })
})

describe('ReportCanvas — marquee select', () => {
  /** The page surface, which carries the marquee pointer handlers. */
  const pageOf = (container: HTMLElement) => container.querySelector('.rb-page') as HTMLElement

  it('selects the elements a rubber-band drag intersects', () => {
    const onMarqueeSelect = vi.fn()
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onMarqueeSelect={onMarqueeSelect} />,
    )
    const page = pageOf(container)

    // The title sits at abs (96..384px, 48..72px); this band covers only it.
    firePointer(page, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(page, 'pointerMove', { clientX: 400, clientY: 90 })
    firePointer(page, 'pointerUp', { clientX: 400, clientY: 90 })

    expect(onMarqueeSelect).toHaveBeenCalledWith(['title'])
  })

  it('selects every intersected element across bands, in document order', () => {
    const onMarqueeSelect = vi.fn()
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onMarqueeSelect={onMarqueeSelect} />,
    )
    const page = pageOf(container)

    // A band spanning the whole page catches the title, the detail field and the footer image.
    firePointer(page, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(page, 'pointerMove', { clientX: 800, clientY: 400 })
    firePointer(page, 'pointerUp', { clientX: 800, clientY: 400 })

    expect(onMarqueeSelect).toHaveBeenCalledWith(['title', 'tons', 'logo'])
  })

  it('reports an empty selection when the rubber-band hits nothing', () => {
    const onMarqueeSelect = vi.fn()
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onMarqueeSelect={onMarqueeSelect} />,
    )
    const page = pageOf(container)

    // An empty corner of the page (the sub-report band has no elements in the fixture).
    firePointer(page, 'pointerDown', { clientX: 600, clientY: 215 })
    firePointer(page, 'pointerMove', { clientX: 790, clientY: 260 })
    firePointer(page, 'pointerUp', { clientX: 790, clientY: 260 })

    expect(onMarqueeSelect).toHaveBeenCalledWith([])
  })

  it('renders the rubber-band rectangle while dragging and removes it on release', () => {
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onMarqueeSelect={vi.fn()} />,
    )
    const page = pageOf(container)

    firePointer(page, 'pointerDown', { clientX: 10, clientY: 10 })
    firePointer(page, 'pointerMove', { clientX: 110, clientY: 60 })

    const band = container.querySelector('.rb-marquee') as HTMLElement
    expect(band).toBeInTheDocument()
    expect(band).toHaveStyle({ left: '10px', top: '10px', width: '100px', height: '50px' })

    firePointer(page, 'pointerUp', { clientX: 110, clientY: 60 })
    expect(container.querySelector('.rb-marquee')).not.toBeInTheDocument()
  })

  it('treats a press-release without a drag as a deselect, not a marquee', () => {
    const onSelectElement = vi.fn()
    const onMarqueeSelect = vi.fn()
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} onMarqueeSelect={onMarqueeSelect} />,
    )
    const page = pageOf(container)

    firePointer(page, 'pointerDown', { clientX: 20, clientY: 20 })
    firePointer(page, 'pointerUp', { clientX: 20, clientY: 20 })

    expect(onSelectElement).toHaveBeenCalledWith(null, false)
    expect(onMarqueeSelect).not.toHaveBeenCalled()
  })

  it('does not start a marquee for a jitter below the drag threshold', () => {
    const onSelectElement = vi.fn()
    const onMarqueeSelect = vi.fn()
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} onMarqueeSelect={onMarqueeSelect} />,
    )
    const page = pageOf(container)

    firePointer(page, 'pointerDown', { clientX: 20, clientY: 20 })
    firePointer(page, 'pointerMove', { clientX: 22, clientY: 21 }) // 2px / 1px — below threshold
    expect(container.querySelector('.rb-marquee')).not.toBeInTheDocument()

    firePointer(page, 'pointerUp', { clientX: 22, clientY: 21 })
    expect(onSelectElement).toHaveBeenCalledWith(null, false)
    expect(onMarqueeSelect).not.toHaveBeenCalled()
  })

  it('does not start a marquee on a non-primary button', () => {
    const onMarqueeSelect = vi.fn()
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onMarqueeSelect={onMarqueeSelect} />,
    )
    const page = pageOf(container)

    firePointer(page, 'pointerDown', { clientX: 0, clientY: 0, button: 2 })
    firePointer(page, 'pointerMove', { clientX: 400, clientY: 400 })
    firePointer(page, 'pointerUp', { clientX: 400, clientY: 400 })

    expect(container.querySelector('.rb-marquee')).not.toBeInTheDocument()
    expect(onMarqueeSelect).not.toHaveBeenCalled()
  })

  it('does not marquee on a read-only canvas (no selection callbacks)', () => {
    const { container } = render(<ReportCanvas template={fixture()} zoom={100} />)
    const page = pageOf(container)

    firePointer(page, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(page, 'pointerMove', { clientX: 400, clientY: 200 })

    expect(container.querySelector('.rb-marquee')).not.toBeInTheDocument()
  })

  it('ignores canvas pointer moves and releases when no marquee is in progress', () => {
    const onSelectElement = vi.fn()
    const onMarqueeSelect = vi.fn()
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} onMarqueeSelect={onMarqueeSelect} />,
    )
    const page = pageOf(container)

    expect(() => {
      firePointer(page, 'pointerMove', { clientX: 50, clientY: 50 })
      firePointer(page, 'pointerUp', { clientX: 50, clientY: 50 })
    }).not.toThrow()
    expect(onSelectElement).not.toHaveBeenCalled()
    expect(onMarqueeSelect).not.toHaveBeenCalled()
  })
})

describe('ReportCanvas — smart guides', () => {
  /** A title (report header) and a data field (detail) that share an x when aligned. */
  function guideFixture(): ReportTemplate {
    const t = createEmptyTemplate('t1', 'T1')
    t.settings.snapToGrid = false // isolate guide logic from grid snapping
    t.bands
      .find((b) => b.kind === 'reportHeader')!
      .elements.push({ id: 'title', type: 'label', rect: { x: 1, y: 0.5, w: 3, h: 0.25 }, text: 'Title' })
    t.bands
      .find((b) => b.kind === 'detail')!
      .elements.push({ id: 'field', type: 'dataField', rect: { x: 2, y: 0.04, w: 1, h: 0.22 }, text: '{F}', expression: '{F}' })
    return t
  }

  it('shows an alignment guide when a dragged edge lines up with another element', () => {
    const { container } = render(
      <ReportCanvas template={guideFixture()} zoom={100} onSelectElement={vi.fn()} onMoveElement={vi.fn()} />,
    )

    // The title's left edge starts at x=1in; dragging +1in brings it to x=2in,
    // lining up with the data field's left edge (also x=2in).
    const title = screen.getByText('Title')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerMove', { clientX: 96, clientY: 0 })

    const guide = container.querySelector('.rb-guide-vertical') as HTMLElement
    expect(guide).toBeInTheDocument()
    expect(guide).toHaveStyle({ left: '192px' }) // x=2in at 96px/in
  })

  it('clears the guides when the drag ends', () => {
    const { container } = render(
      <ReportCanvas template={guideFixture()} zoom={100} onSelectElement={vi.fn()} onMoveElement={vi.fn()} />,
    )

    const title = screen.getByText('Title')
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerMove', { clientX: 96, clientY: 0 })
    expect(container.querySelector('.rb-guide-vertical')).toBeInTheDocument()

    firePointer(title, 'pointerUp', { clientX: 96, clientY: 0 })
    expect(container.querySelector('.rb-guide-vertical')).not.toBeInTheDocument()
  })

  it('shows no guide while a dragged element is not near an alignment', () => {
    const { container } = render(
      <ReportCanvas template={guideFixture()} zoom={100} onSelectElement={vi.fn()} onMoveElement={vi.fn()} />,
    )

    const title = screen.getByText('Title') // x=1in; field x=2in — stay misaligned
    firePointer(title, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(title, 'pointerMove', { clientX: 10, clientY: 0 }) // +~0.1in, far from any line

    expect(container.querySelector('.rb-guide-vertical')).not.toBeInTheDocument()
  })
})

describe('ReportCanvas — inline text editing', () => {
  it('opens an inline editor on double-click, seeded with the element text', async () => {
    const user = userEvent.setup()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onEditText={vi.fn()} />)

    await user.dblClick(screen.getByText('Hello Report'))

    expect(screen.getByRole('textbox', { name: 'Edit text' })).toHaveValue('Hello Report')
  })

  it('reports inline edits through onEditText', async () => {
    const user = userEvent.setup()
    const onEditText = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onEditText={onEditText} />)

    await user.dblClick(screen.getByText('Hello Report'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit text' }), { target: { value: 'Hello World' } })

    expect(onEditText).toHaveBeenCalledWith('title', 'Hello World')
  })

  it('edits a data field token inline, too', async () => {
    const user = userEvent.setup()
    const onEditText = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onEditText={onEditText} />)

    await user.dblClick(screen.getByText('{Record.Tons}'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit text' }), { target: { value: '{Record.HotMix}' } })

    expect(onEditText).toHaveBeenCalledWith('tons', '{Record.HotMix}')
  })

  it('closes the inline editor on Enter, returning to the static element', async () => {
    const user = userEvent.setup()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onEditText={vi.fn()} />)

    await user.dblClick(screen.getByText('Hello Report'))
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit text' }), { key: 'Enter' })

    expect(screen.queryByRole('textbox', { name: 'Edit text' })).not.toBeInTheDocument()
    expect(screen.getByText('Hello Report')).toBeInTheDocument()
  })

  it('closes the inline editor when it loses focus', async () => {
    const user = userEvent.setup()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onEditText={vi.fn()} />)

    await user.dblClick(screen.getByText('Hello Report'))
    fireEvent.blur(screen.getByRole('textbox', { name: 'Edit text' }))

    expect(screen.queryByRole('textbox', { name: 'Edit text' })).not.toBeInTheDocument()
  })

  it('reverts to the original text and closes on Escape', async () => {
    const user = userEvent.setup()
    const onEditText = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onEditText={onEditText} />)

    await user.dblClick(screen.getByText('Hello Report'))
    const input = screen.getByRole('textbox', { name: 'Edit text' })
    fireEvent.change(input, { target: { value: 'changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('textbox', { name: 'Edit text' })).not.toBeInTheDocument()
    expect(onEditText).toHaveBeenLastCalledWith('title', 'Hello Report')
  })

  it('does not open an inline editor for a non-text element', async () => {
    const user = userEvent.setup()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onEditText={vi.fn()} />)

    await user.dblClick(screen.getByRole('button', { name: 'Image' }))

    expect(screen.queryByRole('textbox', { name: 'Edit text' })).not.toBeInTheDocument()
  })

  it('does not open an inline editor when no onEditText handler is provided', async () => {
    const user = userEvent.setup()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} />)

    await user.dblClick(screen.getByText('Hello Report'))

    expect(screen.queryByRole('textbox', { name: 'Edit text' })).not.toBeInTheDocument()
  })

  it('does not start a canvas marquee when pressing inside the inline editor', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ReportCanvas template={fixture()} zoom={100} onSelectElement={vi.fn()} onMarqueeSelect={vi.fn()} onEditText={vi.fn()} />,
    )
    const page = container.querySelector('.rb-page')!

    await user.dblClick(screen.getByText('Hello Report'))
    // A press inside the editor must not reach the page (which would rubber-band).
    firePointer(screen.getByRole('textbox', { name: 'Edit text' }), 'pointerDown', { clientX: 5, clientY: 5 })
    firePointer(page, 'pointerMove', { clientX: 200, clientY: 200 })

    expect(container.querySelector('.rb-marquee')).not.toBeInTheDocument()
  })
})

describe('ReportCanvas — page resize (drag the page edge)', () => {
  it('renders page resize handles when onResizePage is given', () => {
    render(<ReportCanvas template={fixture()} zoom={100} onResizePage={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Resize page width' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resize page height' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resize page' })).toBeInTheDocument()
  })

  it('hides the page resize handles when onResizePage is omitted', () => {
    render(<ReportCanvas template={fixture()} zoom={100} />)

    expect(screen.queryByRole('button', { name: 'Resize page width' })).not.toBeInTheDocument()
  })

  it('widens the page when the east handle is dragged (height unchanged)', () => {
    const onResizePage = vi.fn()
    // fixture() is US Letter (8.5x11); its bands sum to 3.5in, so the page renders 11in tall.
    render(<ReportCanvas template={fixture()} zoom={100} onResizePage={onResizePage} />)

    const handle = screen.getByRole('button', { name: 'Resize page width' })
    firePointer(handle, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(handle, 'pointerMove', { clientX: 96, clientY: 0 }) // +1in

    expect(onResizePage).toHaveBeenLastCalledWith({ width: 9.5, height: 11 })
  })

  it('grows the page height when the south handle is dragged (width unchanged)', () => {
    const onResizePage = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onResizePage={onResizePage} />)

    const handle = screen.getByRole('button', { name: 'Resize page height' })
    firePointer(handle, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(handle, 'pointerMove', { clientX: 0, clientY: 96 }) // +1in

    expect(onResizePage).toHaveBeenLastCalledWith({ width: 8.5, height: 12 })
  })

  it('does not start a page resize with a non-primary button', () => {
    const onResizePage = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onResizePage={onResizePage} />)

    const handle = screen.getByRole('button', { name: 'Resize page' })
    firePointer(handle, 'pointerDown', { clientX: 0, clientY: 0, button: 2 })
    firePointer(handle, 'pointerMove', { clientX: 96, clientY: 96 })

    expect(onResizePage).not.toHaveBeenCalled()
  })

  it('ignores a page handle pointer up when no resize is in progress', () => {
    const onResizePage = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onResizePage={onResizePage} />)

    expect(() => firePointer(screen.getByRole('button', { name: 'Resize page' }), 'pointerUp')).not.toThrow()
    expect(onResizePage).not.toHaveBeenCalled()
  })

  it('stops resizing the page once the pointer is released', () => {
    const onResizePage = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onResizePage={onResizePage} />)

    const handle = screen.getByRole('button', { name: 'Resize page width' })
    firePointer(handle, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(handle, 'pointerUp', { clientX: 0, clientY: 0 })
    onResizePage.mockClear()
    firePointer(handle, 'pointerMove', { clientX: 96, clientY: 0 })

    expect(onResizePage).not.toHaveBeenCalled()
  })

  it('swallows a click on a page handle (no select/deselect)', () => {
    const onSelectElement = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} onResizePage={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Resize page' }))

    expect(onSelectElement).not.toHaveBeenCalled()
  })
})

describe('ReportCanvas — collaboration overlays', () => {
  /** A template with one known label element (id "label-1") in the detail band. */
  function withElement(): ReportTemplate {
    const t = createEmptyTemplate('t1', 'T1')
    t.bands.find((b) => b.kind === 'detail')!.elements.push(createElement('label', 'label-1'))
    return t
  }

  it("overlays a remote participant's selection with their name label", () => {
    render(
      <ReportCanvas
        template={withElement()}
        zoom={100}
        remoteSelections={[{ elementId: 'label-1', color: '#ff0000', label: 'Grace' }]}
      />,
    )

    expect(screen.getByText('Grace')).toBeInTheDocument()
  })

  it('overlays a "being edited by" lock badge for a locked element', () => {
    render(
      <ReportCanvas
        template={withElement()}
        zoom={100}
        locks={[{ elementId: 'label-1', color: '#2563eb', label: 'Ada' }]}
      />,
    )

    expect(screen.getByTitle('Being edited by Ada')).toHaveClass('rb-lock-badge')
  })

  it('renders no overlays when the collaboration props are omitted', () => {
    const { container } = render(<ReportCanvas template={withElement()} zoom={100} />)

    expect(container.querySelector('.rb-remote-selection')).toBeNull()
    expect(container.querySelector('.rb-lock-badge')).toBeNull()
  })
})
