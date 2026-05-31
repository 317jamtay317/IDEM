# GridControl

A reusable, presentation-focused data grid for the React client
(`src/client/src/app/components/GridControl.tsx`). It renders a typed set of
columns over a list of rows as an accessible `<table>`, and supports:

- **Cell templates** — per-column render functions for badges, links, formatting.
- **Paging** — client-side (the grid slices the rows itself) or server-side
  (the parent supplies one page and owns the page state).
- **Inline editing with validation** — per-row Edit / Save / Cancel, custom
  editors, and per-column validators that block the save and surface an error.

`GridControl` is generic over the row type `TRow` and is purely presentational:
it holds only transient UI state (current client page, which row is in edit
mode, the in-progress draft and its validation errors). Persistence is the
caller's responsibility via the `editing.onRowSave` callback.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `GridColumn<TRow>[]` | — | Column definitions, in display order. |
| `rows` | `TRow[]` | — | Rows to display (one page's worth under server paging). |
| `rowKey` | `(row: TRow) => string` | — | Returns a stable, unique key per row. |
| `emptyText` | `string` | `"No records found."` | Message shown when there are no rows. |
| `loading` | `boolean` | `false` | When `true`, a `role="status"` "Loading…" row replaces the data. |
| `ariaLabel` | `string` | — | Accessible label applied to the `<table>`. |
| `paging` | `GridPaging` | — | Paging configuration. Omit for a single, unpaged view. |
| `editing` | `GridEditing<TRow>` | — | Inline-editing configuration. Omit for a read-only grid. |

### `GridColumn<TRow>`

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Column id; also the property read by the default accessor/editor (`row[key]`). |
| `header` | `string` | Column heading; also the `aria-label` of the default editor. |
| `render` | `(row: TRow) => ReactNode` | Cell template for display. Takes precedence over `accessor`. |
| `accessor` | `(row: TRow) => ReactNode` | Display value when no `render` is given. Defaults to `row[key]`. |
| `editable` | `boolean` | Whether the cell is edited inline (requires the grid's `editing` prop). |
| `editor` | `(props: GridCellEditorProps) => ReactNode` | Custom editor template. Defaults to a text input bound to the draft value. |
| `validate` | `(value: unknown, draft: TRow) => string \| undefined` | Run on save; return a message to block the save. |
| `align` | `'left' \| 'center' \| 'right'` | Horizontal alignment for the column's cells. |

### `GridCellEditorProps`

| Field | Type | Description |
|-------|------|-------------|
| `value` | `unknown` | The cell's original value before editing began. |
| `draft` | `unknown` | The cell's current draft value. |
| `error` | `string \| undefined` | Validation message for this cell, if any. |
| `onChange` | `(value: unknown) => void` | Commits a new draft value for the cell. |

### `GridPaging`

A discriminated union on `mode`:

**`ClientGridPaging`** — `{ mode: 'client'; pageSize: number; initialPage?: number }`
The grid holds every row and slices the visible page itself.

**`ServerGridPaging`** — `{ mode: 'server'; page: number; pageSize: number; totalCount: number; onPageChange: (page: number) => void }`
The parent supplies one page of `rows` and is called with the requested
one-based page when the user pages.

### `GridEditing<TRow>`

| Field | Type | Description |
|-------|------|-------------|
| `onRowSave` | `(row: TRow) => void` | Called with the updated row when an inline edit passes validation. |
| `onRowCancel` | `() => void` | Called when an inline edit is cancelled. |

## Events / callbacks

| Callback | Fires when | Payload |
|----------|------------|---------|
| `paging.onPageChange` (server) | Previous/Next clicked | Requested one-based page number. |
| `editing.onRowSave` | Save clicked **and** all validators pass | The edited row (draft). |
| `editing.onRowCancel` | Cancel clicked | — |

> **Note on the default editor.** The built-in editor is a text `<input>`, so
> edited values arrive as **strings**. Coerce in `onRowSave` (e.g. `Number(row.tons)`)
> or supply a custom `editor` that stores the type you need.

## Usage

### Read-only with cell templates

```tsx
<GridControl
  columns={[
    { key: 'type', header: 'Type' },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
  ]}
  rows={records}
  rowKey={(r) => r.id}
  ariaLabel="Records"
  emptyText="No records found."
/>
```

### Client-side paging

```tsx
<GridControl
  columns={columns}
  rows={records}
  rowKey={(r) => r.id}
  paging={{ mode: 'client', pageSize: 10 }}
/>
```

### Server-side paging

```tsx
const [page, setPage] = useState(1)
const { rows, totalCount } = useRecordsPage(page, 20)

<GridControl
  columns={columns}
  rows={rows}
  rowKey={(r) => r.id}
  paging={{ mode: 'server', page, pageSize: 20, totalCount, onPageChange: setPage }}
/>
```

### Inline editing with validation

```tsx
<GridControl
  columns={[
    { key: 'field', header: 'Field' },
    {
      key: 'tons',
      header: 'Tons',
      align: 'right',
      editable: true,
      validate: (value) => (Number(value) < 0 ? 'Tons cannot be negative' : undefined),
    },
  ]}
  rows={entries}
  rowKey={(e) => e.id}
  editing={{
    onRowSave: (row) => saveEntry({ ...row, tons: Number(row.tons) }),
  }}
/>
```

### Custom editor template

```tsx
{
  key: 'field',
  header: 'Field',
  editable: true,
  editor: ({ draft, onChange }) => (
    <SearchableSelect
      options={fieldOptions}
      value={String(draft)}
      onChange={onChange}
      label="Field"
    />
  ),
}
```

## Styling

All styles live in `src/client/src/app/app.css` (the client keeps a single
stylesheet; components do not import their own CSS). Relevant classes:

| Class | Purpose |
|-------|---------|
| `.grid-control` | Wrapper; `overflow-x: auto` keeps wide grids usable on phones. |
| `.grid-control-table` | The `<table>`; reuses the shared `.record-table` look. |
| `.grid-control-align-right` / `-center` | Column alignment, driven by `column.align`. |
| `.grid-control-message` | The empty-state / loading cell. |
| `.grid-control-editor` | Default inline-edit input; `[aria-invalid='true']` shows the error border. |
| `.grid-control-error` | Inline validation message under an editor. |
| `.grid-control-actions` | Per-row Edit / Save / Cancel button group. |
| `.grid-control-pager` / `.grid-control-pager-info` | The pager row and its "Page X of Y" label. |

## Accessibility

- Renders a real `<table>` with `<th>` column headers; `ariaLabel` names it.
- The loading cell carries `role="status"` so screen readers announce it.
- The default editor is labelled by its column `header` and toggles
  `aria-invalid` when its validator fails.

## Tests

`src/client/src/app/components/GridControl.test.tsx` (19 tests, ≥ 80% coverage):
rendering & headers, default accessor vs custom `render`, custom `accessor`,
empty/custom-empty/loading states, `ariaLabel`; client paging (slice, page
info, Next, disabled bounds); server paging (slice + info, `onPageChange`);
inline editing (enter edit, save via `onRowSave`, validation blocks save with
error + `aria-invalid`, cancel restores value + `onRowCancel`, custom editor).
