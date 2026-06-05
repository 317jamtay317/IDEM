import { useCallback, useEffect, useState } from 'react'
import {
  productionFieldsApi as defaultApi,
  DATA_TYPES,
  type ProductionField,
  type ProductionFieldsApi,
  type ProductionFieldDataType,
} from '../productionFieldsApi'
import { GridControl, type GridColumn } from '../components/GridControl'
import { TopBar } from '../components/TopBar'
import { useBreakpoint } from '../useBreakpoint'

/** Sentinel id for the unsaved "new field" row added inline in the grid. */
const NEW_ROW_ID = '__new__'

/** Props for {@link ProductionFieldsScreen}. */
export interface ProductionFieldsScreenProps {
  /** Bearer access token used to authorize catalog requests. */
  accessToken: string | null
  /** Catalog operations. Defaults to the live `fetch` client; injectable for tests. */
  api?: ProductionFieldsApi
}

/** True for the unsaved row created by the grid's add button. */
function isNew(field: ProductionField): boolean {
  return field.id === NEW_ROW_ID
}

/** Coerce a draft cell value to a trimmed string. */
function text(value: unknown): string {
  return String(value ?? '').trim()
}

/**
 * Production Fields screen — the platform-wide catalog a SiteAdmin manages (the
 * property-name → friendly-name dictionary behind the Log a Record picker). The
 * catalog is an editable {@link GridControl}: "Add field" inserts a blank row to
 * enter the immutable PropertyName + metadata (create); "Edit" inline-edits the
 * friendly name, type, category, summary flag, and order (the PropertyName is
 * read-only once set, I-D21); "Retire"/"Reactivate" toggle whether the field is
 * offered for new Records. Renders the grid on desktop and editable cards on
 * mobile/tablet. Authorization is deferred app-wide for now (matches Organizations).
 */
export function ProductionFieldsScreen({ accessToken, api = defaultApi }: ProductionFieldsScreenProps) {
  const { isDesktop } = useBreakpoint()
  const [fields, setFields] = useState<ProductionField[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    let cancelled = false
    api
      .list(accessToken, true)
      .then((data) => {
        if (!cancelled) setFields(data)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, api])

  useEffect(reload, [reload])

  /** Run a mutation, then refresh the list. Surfaces failures inline. */
  async function run(op: () => Promise<unknown>) {
    setError(null)
    try {
      await op()
      reload()
    } catch (e) {
      setError(String(e))
    }
  }

  /** Save handler from the grid: create a new row, or update an existing row's metadata. */
  function handleRowSave(row: ProductionField) {
    if (isNew(row)) {
      if (text(row.propertyName).length === 0 || text(row.friendlyName).length === 0) return
      void run(() =>
        api.create(accessToken, {
          propertyName: text(row.propertyName),
          friendlyName: text(row.friendlyName),
          dataType: row.dataType,
          description: null,
          category: text(row.category).length > 0 ? text(row.category) : null,
          isSummary: Boolean(row.isSummary),
          displayOrder: Number(row.displayOrder) || 0,
        }),
      )
    } else {
      if (text(row.friendlyName).length === 0) return
      void run(() =>
        api.update(accessToken, row.id, {
          friendlyName: text(row.friendlyName),
          dataType: row.dataType,
          description: row.description,
          category: text(row.category).length > 0 ? text(row.category) : null,
          isSummary: Boolean(row.isSummary),
          displayOrder: Number(row.displayOrder) || 0,
        }),
      )
    }
  }

  const columns: GridColumn<ProductionField>[] = [
    {
      key: 'propertyName',
      header: 'Property name',
      // Editable only while new; the key is immutable once set (I-D21).
      editable: true,
      validate: (value, draft) =>
        isNew(draft) && text(value).length === 0 ? 'Property name is required' : undefined,
      editor: ({ draft, row, error, onChange }) => {
        if (!isNew(row as ProductionField)) {
          return <span className="cell-strong">{(row as ProductionField).propertyName}</span>
        }
        return (
          <input
            className="grid-control-editor"
            aria-label="Property name"
            aria-invalid={error ? true : undefined}
            placeholder="e.g. HotMix"
            value={String(draft ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      },
      render: (f) => <span className="cell-strong">{f.propertyName}</span>,
    },
    {
      key: 'friendlyName',
      header: 'Friendly name',
      editable: true,
      validate: (value) => (text(value).length === 0 ? 'Friendly name is required' : undefined),
      editor: ({ draft, error, onChange }) => (
        <input
          className="grid-control-editor"
          aria-label="Friendly name"
          aria-invalid={error ? true : undefined}
          value={String(draft ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
      render: (f) => f.friendlyName,
    },
    {
      key: 'dataType',
      header: 'Type',
      editable: true,
      editor: ({ draft, onChange }) => (
        <select
          className="grid-control-editor"
          aria-label="Data type"
          value={String(draft ?? 'Decimal')}
          onChange={(e) => onChange(e.target.value as ProductionFieldDataType)}
        >
          {DATA_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      ),
      render: (f) => f.dataType,
    },
    {
      key: 'category',
      header: 'Category',
      editable: true,
      editor: ({ draft, onChange }) => (
        <input
          className="grid-control-editor"
          aria-label="Category"
          placeholder="e.g. Fuels & Burners"
          value={String(draft ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
      render: (f) => f.category ?? <span className="muted">—</span>,
    },
    {
      key: 'isSummary',
      header: 'Summary',
      align: 'center',
      editable: true,
      editor: ({ draft, onChange }) => (
        <input
          type="checkbox"
          aria-label="Summary"
          checked={Boolean(draft)}
          onChange={(e) => onChange(e.target.checked)}
        />
      ),
      render: (f) => (f.isSummary ? '✓' : <span className="muted">—</span>),
    },
    {
      key: 'displayOrder',
      header: 'Order',
      align: 'right',
      editable: true,
      editor: ({ draft, onChange }) => (
        <input
          type="number"
          className="grid-control-editor"
          aria-label="Display order"
          value={String(draft ?? 0)}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
      ),
      render: (f) => f.displayOrder,
    },
    {
      key: 'status',
      header: 'Status',
      render: (f) => (f.isActive ? 'Active' : <span className="muted">Retired</span>),
    },
  ]

  return (
    <>
      <TopBar title="Production Fields" subtitle="Manage the Record field catalog" />

      <div className="screen">
        {error && <div className="auth-alert">Error: {error}</div>}

        {fields === null && !error && <p className="muted">Loading production fields…</p>}

        {fields !== null &&
          (isDesktop ? (
            <div className="card table-card">
              <GridControl
                columns={columns}
                rows={fields}
                rowKey={(f) => f.id}
                ariaLabel="Production Fields"
                emptyText="No production fields yet."
                editing={{
                  onRowSave: handleRowSave,
                  newRow: (): ProductionField => ({
                    id: NEW_ROW_ID,
                    propertyName: '',
                    friendlyName: '',
                    description: null,
                    dataType: 'Decimal',
                    category: null,
                    isSummary: false,
                    displayOrder: 0,
                    isActive: true,
                  }),
                  addLabel: 'Add field',
                  rowActions: (f) =>
                    isNew(f) ? null : (
                      <button
                        type="button"
                        className={`button button-sm ${f.isActive ? 'button-secondary' : 'button-primary'}`}
                        onClick={() =>
                          void run(() =>
                            f.isActive ? api.retire(accessToken, f.id) : api.reactivate(accessToken, f.id),
                          )
                        }
                      >
                        {f.isActive ? 'Retire' : 'Reactivate'}
                      </button>
                    ),
                }}
              />
            </div>
          ) : (
            <ProductionFieldCardList
              fields={fields}
              onCreate={(input) => run(() => api.create(accessToken, input))}
              onSave={(id, input) => run(() => api.update(accessToken, id, input))}
              onRetire={(f) =>
                run(() => (f.isActive ? api.retire(accessToken, f.id) : api.reactivate(accessToken, f.id)))
              }
            />
          ))}
      </div>
    </>
  )
}

/** Mobile/tablet equivalent: an add form plus a card per field with inline edit. */
function ProductionFieldCardList({
  fields,
  onCreate,
  onSave,
  onRetire,
}: {
  fields: ProductionField[]
  onCreate: (input: {
    propertyName: string
    friendlyName: string
    dataType: ProductionFieldDataType
    description: null
    category: string | null
    isSummary: boolean
    displayOrder: number
  }) => void
  onSave: (id: string, input: ProductionField) => void
  onRetire: (field: ProductionField) => void
}) {
  const [propertyName, setPropertyName] = useState('')
  const [friendlyName, setFriendlyName] = useState('')
  const [dataType, setDataType] = useState<ProductionFieldDataType>('Decimal')
  const canAdd = propertyName.trim().length > 0 && friendlyName.trim().length > 0

  return (
    <div className="card-list">
      <div className="card">
        <label className="field">
          <span className="field-label">Property name (key)</span>
          <input
            type="text"
            aria-label="Property name"
            placeholder="e.g. HotMix"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Friendly name</span>
          <input
            type="text"
            aria-label="Friendly name"
            placeholder="e.g. Hot Mix"
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Type</span>
          <select
            aria-label="Data type"
            value={dataType}
            onChange={(e) => setDataType(e.target.value as ProductionFieldDataType)}
          >
            {DATA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button button-primary button-block"
          disabled={!canAdd}
          onClick={() => {
            onCreate({
              propertyName: propertyName.trim(),
              friendlyName: friendlyName.trim(),
              dataType,
              description: null,
              category: null,
              isSummary: false,
              displayOrder: 0,
            })
            setPropertyName('')
            setFriendlyName('')
            setDataType('Decimal')
          }}
        >
          Add field
        </button>
      </div>

      {fields.length === 0 && <p className="muted">No production fields yet.</p>}

      {fields.map((f) => (
        <ProductionFieldCard key={f.id} field={f} onSave={onSave} onRetire={onRetire} />
      ))}
    </div>
  )
}

/** A single field card with inline friendly-name/summary edit and retire/reactivate (mobile). */
function ProductionFieldCard({
  field,
  onSave,
  onRetire,
}: {
  field: ProductionField
  onSave: (id: string, input: ProductionField) => void
  onRetire: (field: ProductionField) => void
}) {
  const [editing, setEditing] = useState(false)
  const [friendlyName, setFriendlyName] = useState(field.friendlyName)
  const [isSummary, setIsSummary] = useState(field.isSummary)

  return (
    <div className="card">
      <div className="record-head">
        <div className="facility-summary-heading">
          <span className="card-title">{field.friendlyName}</span>
          <span className="muted">
            {field.propertyName} · {field.dataType}
            {field.category ? ` · ${field.category}` : ''} · {field.isActive ? 'Active' : 'Retired'}
          </span>
        </div>
      </div>

      {editing ? (
        <>
          <label className="field">
            <span className="field-label">Friendly name</span>
            <input
              type="text"
              aria-label="Friendly name"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
            />
          </label>
          <label className="field field-inline">
            <input
              type="checkbox"
              aria-label="Summary"
              checked={isSummary}
              onChange={(e) => setIsSummary(e.target.checked)}
            />
            <span className="field-label">Summary field</span>
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="button button-primary button-sm"
              disabled={friendlyName.trim().length === 0}
              onClick={() => {
                onSave(field.id, { ...field, friendlyName: friendlyName.trim(), isSummary })
                setEditing(false)
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => {
                setFriendlyName(field.friendlyName)
                setIsSummary(field.isSummary)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="row-actions">
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className={`button button-sm ${field.isActive ? 'button-secondary' : 'button-primary'}`}
            onClick={() => onRetire(field)}
          >
            {field.isActive ? 'Retire' : 'Reactivate'}
          </button>
        </div>
      )}
    </div>
  )
}
