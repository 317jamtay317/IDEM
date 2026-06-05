import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from './StatusBar'
import { type ReportElement } from './model'

const el: ReportElement = {
  id: 'title',
  type: 'label',
  rect: { x: 0.42, y: 0.44, w: 4, h: 0.34 },
  text: 'Annual Emissions Inventory',
}

describe('StatusBar', () => {
  it('shows the current zoom', () => {
    render(<StatusBar selected={null} zoom={125} />)

    expect(screen.getByText('Zoom 125%')).toBeInTheDocument()
  })

  it('reports no selection and the page when nothing is selected', () => {
    render(<StatusBar selected={null} zoom={100} />)

    expect(screen.getByText('No selection')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('summarises the selected element with its type and position', () => {
    render(<StatusBar selected={el} zoom={100} />)

    expect(screen.getByText(/Selected: Label/)).toBeInTheDocument()
    expect(screen.getByText(/X 40/)).toBeInTheDocument()
    expect(screen.getByText(/Y 42/)).toBeInTheDocument()
  })

  it('reflects a multi-page document', () => {
    render(<StatusBar selected={null} zoom={100} pageCount={3} />)

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })

  it('shows the current page within a multi-page document', () => {
    render(<StatusBar selected={null} zoom={100} currentPage={2} pageCount={3} />)

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })

  it('names a textless element by its id', () => {
    const box: ReportElement = { id: 'frame', type: 'rectangle', rect: { x: 0, y: 0, w: 2, h: 1 } }
    render(<StatusBar selected={box} zoom={100} />)

    expect(screen.getByText(/Selected: Rectangle "frame"/)).toBeInTheDocument()
  })

  it('shows snap-to-grid on with the grid size in pixels', () => {
    render(<StatusBar selected={null} zoom={100} snapToGrid gridSize={0.125} />)

    expect(screen.getByText('Snap: On · Grid 12px')).toBeInTheDocument()
  })

  it('shows snap-to-grid off without a grid size', () => {
    render(<StatusBar selected={null} zoom={100} snapToGrid={false} gridSize={0.125} />)

    expect(screen.getByText('Snap: Off')).toBeInTheDocument()
  })

  it('summarises a multi-selection by its count', () => {
    render(<StatusBar selected={null} zoom={100} selectedCount={3} />)

    expect(screen.getByText('Selected: 3 elements')).toBeInTheDocument()
  })

  it('still shows the single-element detail when exactly one is selected', () => {
    render(<StatusBar selected={el} zoom={100} selectedCount={1} />)

    expect(screen.getByText(/Selected: Label/)).toBeInTheDocument()
    expect(screen.queryByText(/elements/)).not.toBeInTheDocument()
  })

  it('reports no selection when the count is zero', () => {
    render(<StatusBar selected={null} zoom={100} selectedCount={0} />)

    expect(screen.getByText('No selection')).toBeInTheDocument()
  })
})
