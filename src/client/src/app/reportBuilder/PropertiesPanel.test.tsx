import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PropertiesPanel } from './PropertiesPanel'
import { type ReportElement } from './model'

const labelEl: ReportElement = {
  id: 'title',
  type: 'label',
  rect: { x: 0.42, y: 0.44, w: 4, h: 0.34 },
  text: 'Annual Emissions Inventory',
}

const boundEl: ReportElement = {
  id: 'tons',
  type: 'dataField',
  rect: { x: 1, y: 0, w: 1, h: 0.25 },
  text: '{Record.Tons}',
  expression: '{Record.Tons}',
}

describe('PropertiesPanel', () => {
  it('prompts to select an element when nothing is selected', () => {
    render(<PropertiesPanel element={null} />)

    expect(screen.getByText(/select an element/i)).toBeInTheDocument()
  })

  it('summarises a multi-selection by its count instead of an editor', () => {
    render(<PropertiesPanel element={null} selectedCount={3} />)

    expect(screen.getByText(/3 elements selected/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Text')).not.toBeInTheDocument()
  })

  it('reflects the selected element type', () => {
    render(<PropertiesPanel element={labelEl} />)

    expect(screen.getByText('Label')).toBeInTheDocument()
  })

  it('shows the text and geometry in editable fields (geometry in px)', () => {
    render(<PropertiesPanel element={labelEl} />)

    expect(screen.getByLabelText('Text')).toHaveValue('Annual Emissions Inventory')
    expect(screen.getByLabelText('X')).toHaveValue(40) // 0.42in
    expect(screen.getByLabelText('Y')).toHaveValue(42) // 0.44in
    expect(screen.getByLabelText('W')).toHaveValue(384) // 4in
    expect(screen.getByLabelText('H')).toHaveValue(33) // 0.34in
  })

  it('reports a text edit through onChange', () => {
    const onChange = vi.fn()
    render(<PropertiesPanel element={labelEl} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Quarterly Report' } })

    expect(onChange).toHaveBeenCalledWith({ text: 'Quarterly Report' })
  })

  it('reports an X edit converted to inches, preserving the other dimensions', () => {
    const onChange = vi.fn()
    render(<PropertiesPanel element={labelEl} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('X'), { target: { value: '48' } })

    // 48px → 0.5in; y/w/h keep their exact stored inches.
    expect(onChange).toHaveBeenCalledWith({ rect: { x: 0.5, y: 0.44, w: 4, h: 0.34 } })
  })

  it('reports edits to Y, W and H as inches', () => {
    const onChange = vi.fn()
    render(<PropertiesPanel element={labelEl} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Y'), { target: { value: '96' } })
    expect(onChange).toHaveBeenLastCalledWith({ rect: { x: 0.42, y: 1, w: 4, h: 0.34 } })

    fireEvent.change(screen.getByLabelText('W'), { target: { value: '192' } })
    expect(onChange).toHaveBeenLastCalledWith({ rect: { x: 0.42, y: 0.44, w: 2, h: 0.34 } })

    fireEvent.change(screen.getByLabelText('H'), { target: { value: '48' } })
    expect(onChange).toHaveBeenLastCalledWith({ rect: { x: 0.42, y: 0.44, w: 4, h: 0.5 } })
  })

  it('shows the data binding on the Data tab', async () => {
    const user = userEvent.setup()
    render(<PropertiesPanel element={boundEl} />)

    await user.click(screen.getByRole('tab', { name: 'Data' }))

    expect(screen.getByText('{Record.Tons}')).toBeInTheDocument()
  })

  it('notes when a selected element has no data binding', async () => {
    const user = userEvent.setup()
    render(<PropertiesPanel element={labelEl} />)

    await user.click(screen.getByRole('tab', { name: 'Data' }))

    expect(screen.getByText(/no data binding/i)).toBeInTheDocument()
  })

  it('returns to the Properties tab after viewing Data', async () => {
    const user = userEvent.setup()
    render(<PropertiesPanel element={labelEl} />)

    await user.click(screen.getByRole('tab', { name: 'Data' }))
    await user.click(screen.getByRole('tab', { name: 'Properties' }))

    expect(screen.getByLabelText('W')).toHaveValue(384)
  })
})

const styledEl: ReportElement = {
  id: 'title',
  type: 'label',
  rect: { x: 0.42, y: 0.44, w: 4, h: 0.34 },
  text: 'Title',
  style: { fontFamily: 'Inter', fontSize: 22, fontWeight: 'semibold', italic: true, align: 'center', color: '#0f172a' },
}

describe('PropertiesPanel — style', () => {
  it('reflects the element style in its controls', () => {
    render(<PropertiesPanel element={styledEl} />)

    expect(screen.getByLabelText('Font')).toHaveValue('Inter')
    expect(screen.getByLabelText('Size')).toHaveValue(22)
    expect(screen.getByLabelText('Weight')).toHaveValue('semibold')
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Align center' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Fill')).toHaveValue('#0f172a')
  })

  it('reports font, size and weight edits', () => {
    const onChange = vi.fn()
    render(<PropertiesPanel element={labelEl} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Font'), { target: { value: 'Arial' } })
    expect(onChange).toHaveBeenLastCalledWith({ style: { fontFamily: 'Arial' } })

    fireEvent.change(screen.getByLabelText('Size'), { target: { value: '14' } })
    expect(onChange).toHaveBeenLastCalledWith({ style: { fontSize: 14 } })

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: 'bold' } })
    expect(onChange).toHaveBeenLastCalledWith({ style: { fontWeight: 'bold' } })
  })

  it('reports bold, italic and underline toggles', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PropertiesPanel element={labelEl} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Bold' }))
    expect(onChange).toHaveBeenLastCalledWith({ style: { fontWeight: 'bold' } })

    await user.click(screen.getByRole('button', { name: 'Italic' }))
    expect(onChange).toHaveBeenLastCalledWith({ style: { italic: true } })

    await user.click(screen.getByRole('button', { name: 'Underline' }))
    expect(onChange).toHaveBeenLastCalledWith({ style: { underline: true } })
  })

  it('reports alignment and fill edits', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PropertiesPanel element={labelEl} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Align left' }))
    expect(onChange).toHaveBeenLastCalledWith({ style: { align: 'left' } })

    await user.click(screen.getByRole('button', { name: 'Align center' }))
    expect(onChange).toHaveBeenLastCalledWith({ style: { align: 'center' } })

    await user.click(screen.getByRole('button', { name: 'Align right' }))
    expect(onChange).toHaveBeenLastCalledWith({ style: { align: 'right' } })

    fireEvent.change(screen.getByLabelText('Fill'), { target: { value: '#ff0000' } })
    expect(onChange).toHaveBeenLastCalledWith({ style: { color: '#ff0000' } })
  })

  it('turns a boolean style toggle back off, preserving the rest', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PropertiesPanel element={styledEl} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Italic' })) // italic was on

    const patch = onChange.mock.calls.at(-1)![0]
    expect(patch.style.italic).toBeUndefined()
    expect(patch.style.fontWeight).toBe('semibold') // others preserved
  })
})
