import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataBindingEditor } from './DataBindingEditor'
import { SAMPLE_DATA_CONTEXT } from './sampleData'
import { type ReportElement } from './model'

const dataField: ReportElement = {
  id: 'rec-tons',
  type: 'dataField',
  rect: { x: 0, y: 0, w: 1, h: 0.25 },
  text: '{Record.Tons}',
  expression: '{Record.Tons}',
}

const formula: ReportElement = {
  id: 'total',
  type: 'formula',
  rect: { x: 0, y: 0, w: 1, h: 0.25 },
  text: 'SUM({Record.Tons})',
  expression: 'SUM({Record.Tons})',
}

const staticLabel: ReportElement = {
  id: 'title',
  type: 'label',
  rect: { x: 0, y: 0, w: 4, h: 0.34 },
  text: 'Annual Emissions Inventory',
}

describe('DataBindingEditor — data field', () => {
  it('binds via a Field dropdown that lists the available fields', () => {
    render(<DataBindingEditor element={dataField} />)

    const select = screen.getByLabelText('Field')
    expect(select).toHaveValue('Record.Tons')
    expect(screen.getByRole('option', { name: 'Tons Produced' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Permit Number' })).toBeInTheDocument() // Facility.PermitNumber
  })

  it('reports a new binding through onChange when a field is picked', () => {
    const onChange = vi.fn()
    render(<DataBindingEditor element={dataField} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'Facility.Name' } })

    expect(onChange).toHaveBeenCalledWith({ expression: '{Facility.Name}', text: '{Facility.Name}' })
  })

  it('previews the bound value against the sample data', () => {
    render(<DataBindingEditor element={dataField} />)

    expect(screen.getByText('1280.5', { exact: false })).toBeInTheDocument() // first detail row's Tons
  })
})

describe('DataBindingEditor — formula', () => {
  it('edits the expression through a formula editor', () => {
    const onChange = vi.fn()
    render(<DataBindingEditor element={formula} onChange={onChange} />)

    const input = screen.getByLabelText('Expression')
    expect(input).toHaveValue('SUM({Record.Tons})')

    fireEvent.change(input, { target: { value: 'AVG({Record.Tons})' } })
    expect(onChange).toHaveBeenCalledWith({ expression: 'AVG({Record.Tons})', text: 'AVG({Record.Tons})' })
  })

  it('lists the aggregate functions for discoverability', () => {
    render(<DataBindingEditor element={formula} />)

    expect(screen.getByText(/SUM, AVG, COUNT, MIN, MAX/)).toBeInTheDocument()
  })

  it('inserts a field token into the expression via the Insert field dropdown', () => {
    const onChange = vi.fn()
    const totalLabel: ReportElement = { ...formula, text: 'Total: ', expression: 'Total: ' }
    render(<DataBindingEditor element={totalLabel} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Insert field'), { target: { value: 'Record.Tons' } })

    expect(onChange).toHaveBeenCalledWith({
      expression: 'Total: {Record.Tons}',
      text: 'Total: {Record.Tons}',
    })
  })

  it('previews the evaluated aggregate', () => {
    render(<DataBindingEditor element={formula} />)

    // SUM over the sample rows: 1280.5 + 642.25 + 318
    expect(screen.getByText('2240.75', { exact: false })).toBeInTheDocument()
  })
})

describe('DataBindingEditor — invalid expressions', () => {
  it('flags an unknown field and shows no preview', () => {
    const bad: ReportElement = { ...formula, expression: '{Facility.Phone}', text: '{Facility.Phone}' }
    render(<DataBindingEditor element={bad} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Unknown field: Facility.Phone')
    expect(screen.queryByText(/Preview/)).not.toBeInTheDocument()
  })

  it('flags an unknown function', () => {
    const bad: ReportElement = { ...formula, expression: 'TOTAL({Record.Tons})', text: '' }
    render(<DataBindingEditor element={bad} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Unknown function: TOTAL')
  })

  it('surfaces an evaluator error when a valid binding has no data to preview', () => {
    render(<DataBindingEditor element={dataField} context={{ ...SAMPLE_DATA_CONTEXT, detail: [] }} />)

    expect(screen.getByRole('alert')).toHaveTextContent('No detail rows')
    expect(screen.queryByText(/Preview/)).not.toBeInTheDocument()
  })
})

describe('DataBindingEditor — static element', () => {
  it('notes that a static element has no data binding', () => {
    render(<DataBindingEditor element={staticLabel} />)

    expect(screen.getByText(/no data binding/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Field')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Expression')).not.toBeInTheDocument()
  })
})
