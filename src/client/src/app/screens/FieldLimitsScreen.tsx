import { useEffect, useMemo, useState } from 'react'
import {
  productionFieldsApi as defaultFieldsApi,
  type ProductionField,
  type ProductionFieldDataType,
  type ProductionFieldsApi,
} from '../productionFieldsApi'
import {
  productionFieldLimitsApi as defaultLimitsApi,
  LIMIT_UNITS,
  type LimitUnit,
  type ProductionFieldLimit,
  type ProductionFieldLimitsApi,
} from '../productionFieldLimitsApi'
import { GridControl, type GridColumn } from '../components/GridControl'
import { TopBar } from '../components/TopBar'

/** Props for {@link FieldLimitsScreen}. */
export interface FieldLimitsScreenProps {
  /** Bearer token; the server scopes every read/write to the caller's own Org (I-D03). */
  accessToken?: string | null
  /** Production Field catalog client (the fields a limit can target); injectable for tests. */
  fieldsApi?: ProductionFieldsApi
  /** Production Field Limit client; injectable for tests. Defaults to the live `fetch` client. */
  limitsApi?: ProductionFieldLimitsApi
}

/** The data types a numeric range applies to — only these fields can carry a limit. */
const NUMERIC_TYPES: readonly ProductionFieldDataType[] = ['Decimal', 'Integer']

/** One editable row: a numeric Production Field merged with its current Org limit (if any). */
interface LimitRow {
  propertyName: string
  friendlyName: string
  lowLimit: number | null
  highLimit: number | null
  unit: LimitUnit
  /** Whether the Org has already set a limit for this field. */
  configured: boolean
}

/** Coerce a draft cell value to a trimmed string. */
function text(value: unknown): string {
  return String(value ?? '').trim()
}

/** True when a draft cell holds a parseable finite number. */
function isNumber(value: unknown): boolean {
  return text(value) !== '' && Number.isFinite(Number(value))
}

/**
 * Field Limits screen — the Org's per-Production-Field acceptable ranges that drive Exceedance
 * flagging on the records views. Lists every numeric Production Field (Decimal/Integer) as an editable
 * {@link GridControl} row: set or edit a low/high bound and a unit, saved per row via an upsert
 * (PUT `/me/org/production-field-limits/{propertyName}`). Every read and write is scoped to the caller's
 * own Org server-side from the token (I-D03); the screen never sends an Org id. The low ≤ high rule
 * (I-D25) is enforced client-side before saving and again by the server. Authorization is deferred
 * app-wide for now (matches Production Fields / Organizations); finer Org-Admin gating is a later slice.
 */
export function FieldLimitsScreen({
  accessToken = null,
  fieldsApi = defaultFieldsApi,
  limitsApi = defaultLimitsApi,
}: FieldLimitsScreenProps = {}) {
  const [fields, setFields] = useState<ProductionField[] | null>(null)
  const [limits, setLimits] = useState<Record<string, ProductionFieldLimit> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  // The catalog supplies the fields a limit may target.
  useEffect(() => {
    let cancelled = false
    fieldsApi
      .list(accessToken)
      .then((data) => {
        if (!cancelled) setFields(data)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, fieldsApi])

  // The Org's existing limits, keyed by PropertyName (Org-scoped server-side, I-D03).
  useEffect(() => {
    let cancelled = false
    limitsApi
      .list(accessToken)
      .then((data) => {
        if (!cancelled) setLimits(Object.fromEntries(data.map((l) => [l.propertyName, l])))
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, limitsApi])

  const ready = fields !== null && limits !== null

  const rows = useMemo<LimitRow[]>(() => {
    if (fields === null || limits === null) return []
    return fields
      .filter((f) => f.isActive && NUMERIC_TYPES.includes(f.dataType))
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder || a.friendlyName.localeCompare(b.friendlyName))
      .map((f) => {
        const limit = limits[f.propertyName]
        return {
          propertyName: f.propertyName,
          friendlyName: f.friendlyName,
          lowLimit: limit?.lowLimit ?? null,
          highLimit: limit?.highLimit ?? null,
          unit: limit?.unit ?? 'Tons',
          configured: limit != null,
        }
      })
  }, [fields, limits])

  /** Persist one row's bounds (upsert), then reflect the saved values and confirm. */
  function handleRowSave(row: LimitRow) {
    const lowLimit = Number(row.lowLimit)
    const highLimit = Number(row.highLimit)
    // Validators block an invalid save, but guard defensively before hitting the API.
    if (!Number.isFinite(lowLimit) || !Number.isFinite(highLimit) || highLimit < lowLimit) return

    setError(null)
    setStatus(null)
    limitsApi
      .set(accessToken, row.propertyName, { lowLimit, highLimit, unit: row.unit })
      .then((saved) => {
        setLimits((prev) => ({ ...(prev ?? {}), [saved.propertyName]: saved }))
        setStatus(`Saved ${row.friendlyName} limit.`)
      })
      .catch((e) => setError(String(e)))
  }

  const numberEditor =
    (label: string) =>
    ({ draft, error: cellError, onChange }: { draft: unknown; error?: string; onChange: (v: unknown) => void }) => (
      <input
        type="number"
        step="any"
        className="grid-control-editor"
        aria-label={label}
        aria-invalid={cellError ? true : undefined}
        value={String(draft ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    )

  const columns: GridColumn<LimitRow>[] = [
    {
      key: 'friendlyName',
      header: 'Field',
      render: (r) => (
        <span>
          <span className="cell-strong">{r.friendlyName}</span>{' '}
          <span className="muted">{r.propertyName}</span>
        </span>
      ),
    },
    {
      key: 'lowLimit',
      header: 'Low limit',
      align: 'right',
      editable: true,
      validate: (value) => (isNumber(value) ? undefined : 'Low limit is required'),
      editor: numberEditor('Low limit'),
      render: (r) => (r.configured && r.lowLimit != null ? r.lowLimit.toLocaleString('en-US') : '—'),
    },
    {
      key: 'highLimit',
      header: 'High limit',
      align: 'right',
      editable: true,
      validate: (value, draft) => {
        if (!isNumber(value)) return 'High limit is required'
        const low = Number(draft.lowLimit)
        // I-D25: the range must not be empty.
        if (Number.isFinite(low) && Number(value) < low) return 'High limit must be ≥ low limit'
        return undefined
      },
      editor: numberEditor('High limit'),
      render: (r) => (r.configured && r.highLimit != null ? r.highLimit.toLocaleString('en-US') : '—'),
    },
    {
      key: 'unit',
      header: 'Unit',
      editable: true,
      editor: ({ draft, onChange }) => (
        <select
          className="grid-control-editor"
          aria-label="Unit"
          value={String(draft ?? 'Tons')}
          onChange={(e) => onChange(e.target.value as LimitUnit)}
        >
          {LIMIT_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      ),
      render: (r) => (r.configured ? r.unit : <span className="muted">—</span>),
    },
  ]

  return (
    <>
      <TopBar title="Field Limits" subtitle="Set the acceptable range for each field" />

      <div className="screen">
        {error && <div className="auth-alert">Error: {error}</div>}
        {status && (
          <p className="form-status" role="status">
            {status}
          </p>
        )}

        {!ready && !error && <p className="muted">Loading field limits…</p>}

        {ready && (
          <div className="card table-card">
            <GridControl
              columns={columns}
              rows={rows}
              rowKey={(r) => r.propertyName}
              ariaLabel="Field Limits"
              emptyText="No numeric fields to limit."
              paging={{ mode: 'client', pageSize: 15 }}
              editing={{
                onRowSave: handleRowSave,
                editLabel: (r) => (r.configured ? 'Edit' : 'Set'),
              }}
            />
          </div>
        )}
      </div>
    </>
  )
}
