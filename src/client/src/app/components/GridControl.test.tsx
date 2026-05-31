import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GridControl } from './GridControl'
import type { GridColumn } from './GridControl'

/** A sample row type used to exercise the generic grid. Mirrors a ProductionEntry. */
interface Entry {
  id: string
  field: string
  tons: number
  limit: number
}

const entries: Entry[] = [
  { id: 'p1', field: 'Hot Mix', tons: 1240, limit: 1500 },
  { id: 'p2', field: 'Cold Mix', tons: 320, limit: 500 },
]

const columns: GridColumn<Entry>[] = [
  { key: 'field', header: 'Field' },
  { key: 'tons', header: 'Tons' },
]

const rowKey = (entry: Entry) => entry.id

describe('GridControl — rendering & cell templates', () => {
  it('renders a column header for each column', () => {
    render(<GridControl columns={columns} rows={entries} rowKey={rowKey} />)

    expect(screen.getByRole('columnheader', { name: 'Field' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tons' })).toBeInTheDocument()
  })

  it('renders a row per item using the default accessor (row[key])', () => {
    render(<GridControl columns={columns} rows={entries} rowKey={rowKey} />)

    expect(screen.getByText('Hot Mix')).toBeInTheDocument()
    expect(screen.getByText('Cold Mix')).toBeInTheDocument()
    expect(screen.getByText('1240')).toBeInTheDocument()
  })

  it('renders a custom cell template when render is provided', () => {
    const templated: GridColumn<Entry>[] = [
      { key: 'field', header: 'Field' },
      { key: 'tons', header: 'Tons', render: (entry) => <strong data-testid="tons">{entry.tons} t</strong> },
    ]

    render(<GridControl columns={templated} rows={entries} rowKey={rowKey} />)

    const rendered = screen.getAllByTestId('tons')
    expect(rendered[0]).toHaveTextContent('1240 t')
    expect(rendered[1]).toHaveTextContent('320 t')
  })

  it('uses a custom accessor for the displayed value', () => {
    const computed: GridColumn<Entry>[] = [
      { key: 'headroom', header: 'Headroom', accessor: (entry) => entry.limit - entry.tons },
    ]

    render(<GridControl columns={computed} rows={entries} rowKey={rowKey} />)

    const cells = screen.getAllByRole('cell')
    expect(cells[0]).toHaveTextContent('260')
  })

  it('shows the default empty message when there are no rows', () => {
    render(<GridControl columns={columns} rows={[]} rowKey={rowKey} />)

    expect(screen.getByText('No records found.')).toBeInTheDocument()
  })

  it('shows a custom empty message when provided', () => {
    render(<GridControl columns={columns} rows={[]} rowKey={rowKey} emptyText="No entries yet" />)

    expect(screen.getByText('No entries yet')).toBeInTheDocument()
  })

  it('shows a loading indicator and hides data rows while loading', () => {
    render(<GridControl columns={columns} rows={entries} rowKey={rowKey} loading />)

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
    expect(screen.queryByText('Hot Mix')).not.toBeInTheDocument()
  })

  it('labels the table with the provided ariaLabel', () => {
    render(<GridControl columns={columns} rows={entries} rowKey={rowKey} ariaLabel="Production entries" />)

    const table = screen.getByRole('table', { name: 'Production entries' })
    expect(within(table).getByText('Hot Mix')).toBeInTheDocument()
  })
})

const manyEntries: Entry[] = Array.from({ length: 5 }, (_, i) => ({
  id: `e${i}`,
  field: `Field ${i}`,
  tons: i * 10,
  limit: 1000,
}))

describe('GridControl — client-side paging', () => {
  it('shows only the first page of rows', () => {
    render(
      <GridControl
        columns={columns}
        rows={manyEntries}
        rowKey={rowKey}
        paging={{ mode: 'client', pageSize: 2 }}
      />,
    )

    expect(screen.getByText('Field 0')).toBeInTheDocument()
    expect(screen.getByText('Field 1')).toBeInTheDocument()
    expect(screen.queryByText('Field 2')).not.toBeInTheDocument()
  })

  it('reports the current page and total pages', () => {
    render(
      <GridControl
        columns={columns}
        rows={manyEntries}
        rowKey={rowKey}
        paging={{ mode: 'client', pageSize: 2 }}
      />,
    )

    // 5 rows / 2 per page = 3 pages.
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
  })

  it('advances to the next page when Next is clicked', async () => {
    const user = userEvent.setup()
    render(
      <GridControl
        columns={columns}
        rows={manyEntries}
        rowKey={rowKey}
        paging={{ mode: 'client', pageSize: 2 }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('Field 2')).toBeInTheDocument()
    expect(screen.queryByText('Field 0')).not.toBeInTheDocument()
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument()
  })

  it('disables Previous on the first page and Next on the last page', async () => {
    const user = userEvent.setup()
    render(
      <GridControl
        columns={columns}
        rows={manyEntries}
        rowKey={rowKey}
        paging={{ mode: 'client', pageSize: 2 }}
      />,
    )

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText(/page 3 of 3/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })
})

describe('GridControl — server-side paging', () => {
  it('renders the given page slice and total without slicing rows itself', () => {
    render(
      <GridControl
        columns={columns}
        rows={entries}
        rowKey={rowKey}
        paging={{ mode: 'server', page: 2, pageSize: 2, totalCount: 6, onPageChange: vi.fn() }}
      />,
    )

    // The parent supplies exactly the rows for page 2; the grid shows all of them.
    expect(screen.getByText('Hot Mix')).toBeInTheDocument()
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument()
  })

  it('calls onPageChange with the requested page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <GridControl
        columns={columns}
        rows={entries}
        rowKey={rowKey}
        paging={{ mode: 'server', page: 1, pageSize: 2, totalCount: 6, onPageChange }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})

describe('GridControl — inline editing & validation', () => {
  const editColumns: GridColumn<Entry>[] = [
    { key: 'field', header: 'Field' },
    {
      key: 'tons',
      header: 'Tons',
      editable: true,
      validate: (value) => (Number(value) < 0 ? 'Tons cannot be negative' : undefined),
    },
  ]

  it('enters edit mode and shows an editor for editable cells', async () => {
    const user = userEvent.setup()
    render(
      <GridControl columns={editColumns} rows={entries} rowKey={rowKey} editing={{ onRowSave: vi.fn() }} />,
    )

    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

    expect(screen.getByLabelText('Tons')).toHaveValue('1240')
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('saves the edited row via onRowSave with the updated value', async () => {
    const user = userEvent.setup()
    const onRowSave = vi.fn()
    render(
      <GridControl columns={editColumns} rows={entries} rowKey={rowKey} editing={{ onRowSave }} />,
    )

    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])
    const input = screen.getByLabelText('Tons')
    await user.clear(input)
    await user.type(input, '999')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(onRowSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', tons: '999' }))
  })

  it('blocks save and shows an error when validation fails', async () => {
    const user = userEvent.setup()
    const onRowSave = vi.fn()
    render(
      <GridControl columns={editColumns} rows={entries} rowKey={rowKey} editing={{ onRowSave }} />,
    )

    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])
    const input = screen.getByLabelText('Tons')
    await user.clear(input)
    await user.type(input, '-5')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(onRowSave).not.toHaveBeenCalled()
    expect(screen.getByText('Tons cannot be negative')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('discards changes and calls onRowCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onRowSave = vi.fn()
    const onRowCancel = vi.fn()
    render(
      <GridControl
        columns={editColumns}
        rows={entries}
        rowKey={rowKey}
        editing={{ onRowSave, onRowCancel }}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])
    await user.clear(screen.getByLabelText('Tons'))
    await user.type(screen.getByLabelText('Tons'), '7')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onRowSave).not.toHaveBeenCalled()
    expect(onRowCancel).toHaveBeenCalledTimes(1)
    // Original value is shown again, editor gone.
    expect(screen.queryByLabelText('Tons')).not.toBeInTheDocument()
    expect(screen.getByText('1240')).toBeInTheDocument()
  })

  it('renders a custom editor template when provided', async () => {
    const user = userEvent.setup()
    const customColumns: GridColumn<Entry>[] = [
      { key: 'field', header: 'Field' },
      {
        key: 'tons',
        header: 'Tons',
        editable: true,
        editor: ({ draft, onChange }) => (
          <input data-testid="custom-editor" value={String(draft)} onChange={(e) => onChange(e.target.value)} />
        ),
      },
    ]
    render(
      <GridControl columns={customColumns} rows={entries} rowKey={rowKey} editing={{ onRowSave: vi.fn() }} />,
    )

    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

    expect(screen.getByTestId('custom-editor')).toBeInTheDocument()
  })
})
