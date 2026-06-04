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
  { clientX = 0, clientY = 0, button = 0 }: { clientX?: number; clientY?: number; button?: number } = {},
) {
  const event = createEvent[type](node, { pointerId: 1 })
  Object.defineProperty(event, 'clientX', { get: () => clientX })
  Object.defineProperty(event, 'clientY', { get: () => clientY })
  Object.defineProperty(event, 'button', { get: () => button })
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
  it('reports the element id when an element is clicked', async () => {
    const onSelectElement = vi.fn()
    const user = userEvent.setup()
    render(<ReportCanvas template={fixture()} zoom={100} onSelectElement={onSelectElement} />)

    await user.click(screen.getByText('Hello Report'))

    expect(onSelectElement).toHaveBeenCalledWith('title')
  })

  it('marks the selected element as pressed and others as not', () => {
    render(<ReportCanvas template={fixture()} zoom={100} selectedId="title" />)

    expect(screen.getByText('Hello Report')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('{Record.Tons}')).toHaveAttribute('aria-pressed', 'false')
  })

  it('deselects when the empty canvas is clicked', async () => {
    const onSelectElement = vi.fn()
    const user = userEvent.setup()
    render(
      <ReportCanvas
        template={fixture()}
        zoom={100}
        selectedId="title"
        onSelectElement={onSelectElement}
      />,
    )

    // The Page Header band is empty in the fixture — clicking it is a canvas click.
    await user.click(screen.getByRole('group', { name: BAND_LABELS.pageHeader }))

    expect(onSelectElement).toHaveBeenCalledWith(null)
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

    expect(onSelectElement).toHaveBeenCalledWith('title')
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
})

describe('ReportCanvas — resize', () => {
  it('shows four corner handles on the selected element', () => {
    render(<ReportCanvas template={fixture()} zoom={100} selectedId="title" onResize={vi.fn()} />)

    for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      expect(screen.getByRole('button', { name: `Resize ${corner}` })).toBeInTheDocument()
    }
  })

  it('shows no resize handles when nothing is selected', () => {
    render(<ReportCanvas template={fixture()} zoom={100} onResize={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Resize/ })).not.toBeInTheDocument()
  })

  it('resizes from a corner handle as it is dragged', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedId="title" onResize={onResize} />)

    // title rect = {x:1, y:0.5, w:3, h:0.25}; drag SE by +96px,+48px → +1in,+0.5in.
    const se = screen.getByRole('button', { name: 'Resize bottom-right' })
    firePointer(se, 'pointerDown', { clientX: 0, clientY: 0 })
    firePointer(se, 'pointerMove', { clientX: 96, clientY: 48 })

    expect(onResize).toHaveBeenLastCalledWith('title', { x: 1, y: 0.5, w: 4, h: 0.75 })
  })

  it('does not start a resize on a non-primary button', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedId="title" onResize={onResize} />)

    const se = screen.getByRole('button', { name: 'Resize bottom-right' })
    firePointer(se, 'pointerDown', { clientX: 0, clientY: 0, button: 2 })
    firePointer(se, 'pointerMove', { clientX: 96, clientY: 48 })

    expect(onResize).not.toHaveBeenCalled()
  })

  it('does not resize before a handle drag has started', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedId="title" onResize={onResize} />)

    firePointer(screen.getByRole('button', { name: 'Resize bottom-right' }), 'pointerMove', { clientX: 96, clientY: 48 })

    expect(onResize).not.toHaveBeenCalled()
  })

  it('ignores a handle pointer up when no resize is in progress', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedId="title" onResize={onResize} />)

    expect(() => firePointer(screen.getByRole('button', { name: 'Resize bottom-right' }), 'pointerUp')).not.toThrow()
    expect(onResize).not.toHaveBeenCalled()
  })

  it('stops resizing once the pointer is released', () => {
    const onResize = vi.fn()
    render(<ReportCanvas template={fixture()} zoom={100} selectedId="title" onResize={onResize} />)

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
      <ReportCanvas template={fixture()} zoom={100} selectedId="title" onSelectElement={onSelectElement} onResize={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Resize bottom-right' }))

    expect(onSelectElement).not.toHaveBeenCalled() // the handle swallows the click; no deselect
  })
})
