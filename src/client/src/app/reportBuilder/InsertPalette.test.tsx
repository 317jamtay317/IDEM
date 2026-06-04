import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsertPalette } from './InsertPalette'
import { ELEMENT_DRAG_MIME } from './dnd'

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

const ALL_LABELS = [
  'Label',
  'Formula',
  'Data Field',
  'Line',
  'Rectangle',
  'Triangle',
  'Ellipse',
  'Image',
  'Barcode',
  'Sub Report',
  'Table',
  'Chart',
  'Page Break',
]

describe('InsertPalette', () => {
  it('shows the palette groups as headings', () => {
    render(<InsertPalette onInsert={vi.fn()} />)

    for (const group of ['Text', 'Shapes', 'Media', 'Advanced']) {
      expect(screen.getByText(group)).toBeInTheDocument()
    }
  })

  it('offers a button for every palette element type', () => {
    render(<InsertPalette onInsert={vi.fn()} />)

    for (const label of ALL_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('reports the element type when an item is clicked', async () => {
    const onInsert = vi.fn()
    const user = userEvent.setup()
    render(<InsertPalette onInsert={onInsert} />)

    await user.click(screen.getByRole('button', { name: 'Rectangle' }))

    expect(onInsert).toHaveBeenCalledWith('rectangle')
  })

  it('filters items by the query, hiding groups with no match', () => {
    render(<InsertPalette onInsert={vi.fn()} query="tab" />)

    expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Label' })).not.toBeInTheDocument()
    expect(screen.queryByText('Text')).not.toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('matches the query case-insensitively', () => {
    render(<InsertPalette onInsert={vi.fn()} query="ELLIP" />)

    expect(screen.getByRole('button', { name: 'Ellipse' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Image' })).not.toBeInTheDocument()
  })

  it('shows an empty message when nothing matches', () => {
    render(<InsertPalette onInsert={vi.fn()} query="zzz" />)

    expect(screen.getByText(/no matching/i)).toBeInTheDocument()
  })

  it('marks palette items as draggable', () => {
    render(<InsertPalette onInsert={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Line' })).toHaveAttribute('draggable', 'true')
  })

  it('starts a drag carrying the element type', () => {
    render(<InsertPalette onInsert={vi.fn()} />)
    const dataTransfer = makeDataTransfer()

    fireEvent.dragStart(screen.getByRole('button', { name: 'Rectangle' }), { dataTransfer })

    expect(dataTransfer.getData(ELEMENT_DRAG_MIME)).toBe('rectangle')
  })
})

describe('InsertPalette — compact', () => {
  it('shows icon-only buttons named by a tooltip, with no visible labels or group headings', () => {
    render(<InsertPalette compact onInsert={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Rectangle' })
    expect(button).toHaveAttribute('title', 'Rectangle')
    expect(screen.queryByText('Rectangle')).not.toBeInTheDocument() // label is a tooltip, not text
    expect(screen.queryByText('Shapes')).not.toBeInTheDocument() // no group headers in the rail
  })

  it('still offers every element type and reports clicks', async () => {
    const onInsert = vi.fn()
    const user = userEvent.setup()
    render(<InsertPalette compact onInsert={onInsert} />)

    expect(screen.getAllByRole('button')).toHaveLength(13)
    await user.click(screen.getByRole('button', { name: 'Chart' }))
    expect(onInsert).toHaveBeenCalledWith('chart')
  })

  it('keeps compact items draggable', () => {
    render(<InsertPalette compact onInsert={vi.fn()} />)
    const dataTransfer = makeDataTransfer()

    fireEvent.dragStart(screen.getByRole('button', { name: 'Image' }), { dataTransfer })

    expect(dataTransfer.getData(ELEMENT_DRAG_MIME)).toBe('image')
  })
})
