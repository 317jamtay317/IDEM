import { useState, type ReactNode } from 'react'

/**
 * Props passed to a custom cell editor ({@link GridColumn.editor}) while a row
 * is being edited inline.
 */
export interface GridCellEditorProps {
  /** The cell's original value before editing began. */
  value: unknown
  /** The cell's current draft value. */
  draft: unknown
  /** Validation message for this cell, if any. */
  error?: string
  /** Commits a new draft value for the cell. */
  onChange: (value: unknown) => void
}

/**
 * A single column definition for {@link GridControl}.
 *
 * @typeParam TRow - The shape of one row of grid data.
 */
export interface GridColumn<TRow> {
  /**
   * Stable key identifying the column. Also the property read from each row by
   * the default accessor/editor when none is supplied.
   */
  key: string
  /** Column heading shown in the table header. */
  header: string
  /**
   * Optional cell template. When supplied, its returned node is rendered in the
   * cell instead of the raw value — use for badges, links, formatting, etc.
   */
  render?: (row: TRow) => ReactNode
  /**
   * Optional value accessor used for display when no {@link GridColumn.render}
   * is given. Defaults to reading `row[key]`.
   */
  accessor?: (row: TRow) => ReactNode
  /** Whether this cell can be edited inline. Requires the grid's `editing` prop. */
  editable?: boolean
  /**
   * Optional custom editor template rendered while the row is in edit mode.
   * Defaults to a text input bound to the draft value.
   */
  editor?: (props: GridCellEditorProps) => ReactNode
  /**
   * Optional validator run on save. Returns an error message to block the save,
   * or `undefined` when the draft value is valid.
   */
  validate?: (value: unknown, draft: TRow) => string | undefined
  /** Optional horizontal alignment for the column's cells. */
  align?: 'left' | 'center' | 'right'
}

/** Client-side paging: the grid holds every row and slices the visible page itself. */
export interface ClientGridPaging {
  /** Discriminator selecting client-side paging. */
  mode: 'client'
  /** Number of rows shown per page. */
  pageSize: number
  /** One-based page to show first. Defaults to `1`. */
  initialPage?: number
}

/** Server-side paging: the parent supplies one page of rows and owns the page state. */
export interface ServerGridPaging {
  /** Discriminator selecting server-side paging. */
  mode: 'server'
  /** The one-based page currently supplied in `rows`. */
  page: number
  /** Number of rows per page. */
  pageSize: number
  /** Total number of rows across all pages. */
  totalCount: number
  /** Called with the requested one-based page when the user pages. */
  onPageChange: (page: number) => void
}

/** Paging configuration for {@link GridControl}. */
export type GridPaging = ClientGridPaging | ServerGridPaging

/**
 * Inline-editing configuration for {@link GridControl}.
 *
 * @typeParam TRow - The shape of one row of grid data.
 */
export interface GridEditing<TRow> {
  /** Called with the updated row when an inline edit passes validation. */
  onRowSave: (row: TRow) => void
  /** Called when an inline edit is cancelled. */
  onRowCancel?: () => void
}

/**
 * Props for {@link GridControl}.
 *
 * @typeParam TRow - The shape of one row of grid data.
 */
export interface GridControlProps<TRow> {
  /** Column definitions, in display order. */
  columns: GridColumn<TRow>[]
  /** The rows to display (one page's worth under server-side paging). */
  rows: TRow[]
  /** Returns a stable, unique key for a row. */
  rowKey: (row: TRow) => string
  /** Message shown when there are no rows. Defaults to `"No records found."`. */
  emptyText?: string
  /** When `true`, a loading indicator replaces the rows. */
  loading?: boolean
  /** Accessible label applied to the underlying table element. */
  ariaLabel?: string
  /** Paging configuration. Omit for a single, unpaged view. */
  paging?: GridPaging
  /** Inline-editing configuration. Omit for a read-only grid. */
  editing?: GridEditing<TRow>
}

/** Resolve the node shown in a non-editing cell: template, then accessor, then `row[key]`. */
function cellContent<TRow>(column: GridColumn<TRow>, row: TRow): ReactNode {
  if (column.render) return column.render(row)
  if (column.accessor) return column.accessor(row)
  return (row as Record<string, ReactNode>)[column.key]
}

/** CSS class for a column's horizontal alignment, if any. */
function alignClass(align: GridColumn<unknown>['align']): string | undefined {
  if (align === 'right') return 'grid-control-align-right'
  if (align === 'center') return 'grid-control-align-center'
  return undefined
}

/**
 * A reusable, presentation-focused data grid. Renders {@link GridControlProps.columns}
 * over {@link GridControlProps.rows} as an accessible table, with per-column cell
 * templates, an empty state, a loading state, optional paging (client- or
 * server-side) and optional inline editing with validation.
 *
 * @typeParam TRow - The shape of one row of grid data.
 *
 * @example
 * ```tsx
 * <GridControl
 *   columns={[
 *     { key: 'field', header: 'Field' },
 *     { key: 'tons', header: 'Tons', editable: true,
 *       validate: (v) => (Number(v) < 0 ? 'Must be ≥ 0' : undefined) },
 *   ]}
 *   rows={entries}
 *   rowKey={(r) => r.id}
 *   paging={{ mode: 'client', pageSize: 10 }}
 *   editing={{ onRowSave: save }}
 * />
 * ```
 */
export function GridControl<TRow>({
  columns,
  rows,
  rowKey,
  emptyText = 'No records found.',
  loading = false,
  ariaLabel,
  paging,
  editing,
}: GridControlProps<TRow>) {
  const [clientPage, setClientPage] = useState(
    paging?.mode === 'client' ? paging.initialPage ?? 1 : 1,
  )
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const columnCount = columns.length + (editing ? 1 : 0)

  // Resolve the visible rows and pager from the paging configuration.
  let visibleRows = rows
  let pager: ReactNode = null
  if (paging?.mode === 'client') {
    const totalPages = Math.max(1, Math.ceil(rows.length / paging.pageSize))
    const current = Math.min(clientPage, totalPages)
    visibleRows = rows.slice((current - 1) * paging.pageSize, current * paging.pageSize)
    pager = renderPager(
      current,
      totalPages,
      () => setClientPage(current - 1),
      () => setClientPage(current + 1),
    )
  } else if (paging?.mode === 'server') {
    const totalPages = Math.max(1, Math.ceil(paging.totalCount / paging.pageSize))
    pager = renderPager(
      paging.page,
      totalPages,
      () => paging.onPageChange(paging.page - 1),
      () => paging.onPageChange(paging.page + 1),
    )
  }

  function beginEdit(row: TRow) {
    setEditingKey(rowKey(row))
    setDraft({ ...(row as Record<string, unknown>) })
    setErrors({})
  }

  function changeDraft(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function saveEdit() {
    const nextErrors: Record<string, string> = {}
    for (const column of columns) {
      if (column.editable && column.validate) {
        const message = column.validate(draft[column.key], draft as TRow)
        if (message) nextErrors[column.key] = message
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    editing?.onRowSave(draft as TRow)
    setEditingKey(null)
    setErrors({})
  }

  function cancelEdit() {
    setEditingKey(null)
    setErrors({})
    editing?.onRowCancel?.()
  }

  /** Render the editor for an editable cell in the row currently being edited. */
  function renderEditor(column: GridColumn<TRow>, row: TRow): ReactNode {
    const value = (row as Record<string, unknown>)[column.key]
    const draftValue = draft[column.key]
    const error = errors[column.key]
    const editorNode = column.editor
      ? column.editor({ value, draft: draftValue, error, onChange: (v) => changeDraft(column.key, v) })
      : (
          <input
            className="grid-control-editor"
            aria-label={column.header}
            aria-invalid={error ? true : undefined}
            value={String(draftValue ?? '')}
            onChange={(event) => changeDraft(column.key, event.target.value)}
          />
        )
    return (
      <>
        {editorNode}
        {error && <span className="grid-control-error">{error}</span>}
      </>
    )
  }

  return (
    <div className="grid-control">
      <table className="grid-control-table record-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={alignClass(column.align)}>
                {column.header}
              </th>
            ))}
            {editing && <th className="grid-control-actions-header">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="grid-control-message" colSpan={columnCount} role="status">
                Loading…
              </td>
            </tr>
          ) : visibleRows.length === 0 ? (
            <tr>
              <td className="grid-control-message" colSpan={columnCount}>
                {emptyText}
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => {
              const key = rowKey(row)
              const isEditing = editingKey === key
              return (
                <tr key={key}>
                  {columns.map((column) => (
                    <td key={column.key} className={alignClass(column.align)}>
                      {isEditing && column.editable
                        ? renderEditor(column, row)
                        : cellContent(column, row)}
                    </td>
                  ))}
                  {editing && (
                    <td className="grid-control-actions">
                      {isEditing ? (
                        <>
                          <button type="button" className="button button-primary" onClick={saveEdit}>
                            Save
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => beginEdit(row)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
      {pager}
    </div>
  )
}

/** Render the Previous / "Page X of Y" / Next pager shared by both paging modes. */
function renderPager(
  current: number,
  totalPages: number,
  onPrevious: () => void,
  onNext: () => void,
): ReactNode {
  return (
    <div className="grid-control-pager">
      <button
        type="button"
        className="button button-secondary"
        onClick={onPrevious}
        disabled={current <= 1}
      >
        Previous
      </button>
      <span className="grid-control-pager-info">
        Page {current} of {totalPages}
      </span>
      <button
        type="button"
        className="button button-secondary"
        onClick={onNext}
        disabled={current >= totalPages}
      >
        Next
      </button>
    </div>
  )
}
