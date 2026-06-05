import { useCallback, useEffect, useState } from 'react'
import {
  myFacilitiesApi as defaultApi,
  EMISSION_TYPES,
  type EmissionType,
  type MonthlyLimit,
  type MyFacilitiesApi,
  type MyFacility,
  type Permit,
} from '../myFacilitiesApi'
import { TopBar } from '../components/TopBar'
import { Tabs } from '../components/Tabs'
import { GridControl, type GridColumn } from '../components/GridControl'
import { DatePicker } from '../components/DatePicker'
import { ArrowLeftIcon } from '../components/icons'

/** Sentinel id for the unsaved "new" row opened by a grid's inline add ("+"). */
const NEW_ROW_ID = '__new__'

/** Thousands-grouped display of a tons/month value (e.g. 152000 → "152,000"). */
const TONS_FORMAT = new Intl.NumberFormat('en-US')

/** Props for {@link FacilityDetailScreen}. */
export interface FacilityDetailScreenProps {
  /** The Facility to show, identified by id. Resolved against the caller's Org list. */
  facilityId: string
  /** Bearer access token used to authorize the requests. */
  accessToken: string | null
  /**
   * CRUD operations for the caller's Facilities, Permits, and Monthly Limits.
   * Defaults to the live `fetch`-backed client; injectable so tests can drive the
   * screen without a network or auth provider.
   */
  api?: MyFacilitiesApi
  /** Invoked when the user navigates back to the Facilities list. */
  onBack: () => void
}

/**
 * Facility details — an Org User manages a single Facility's Permits and Monthly
 * Limits (I-D06), organized into tabs. Every call is scoped server-side to the
 * caller's Org via the `org_id` claim (I-D03); the screen never sends an Org id.
 * Each tab lists its records in a {@link GridControl}, where the "+" affordance
 * opens a blank editable row inline. The Facility itself is resolved from the
 * Org's Facility list (no dedicated single-Facility endpoint).
 */
export function FacilityDetailScreen({
  facilityId,
  accessToken,
  api = defaultApi,
  onBack,
}: FacilityDetailScreenProps) {
  // undefined = still loading; null = no such Facility in the caller's Org.
  const [facility, setFacility] = useState<MyFacility | null | undefined>(undefined)
  const [permits, setPermits] = useState<Permit[] | null>(null)
  const [limits, setLimits] = useState<MonthlyLimit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .list(accessToken)
      .then((all) => {
        if (!cancelled) setFacility(all.find((f) => f.id === facilityId) ?? null)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, api, facilityId])

  const reloadPermits = useCallback(() => {
    let cancelled = false
    api
      .listPermits(accessToken, facilityId)
      .then((data) => {
        if (!cancelled) setPermits(data)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, api, facilityId])

  const reloadLimits = useCallback(() => {
    let cancelled = false
    api
      .listLimits(accessToken, facilityId)
      .then((data) => {
        if (!cancelled) setLimits(data)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, api, facilityId])

  useEffect(reloadPermits, [reloadPermits])
  useEffect(reloadLimits, [reloadLimits])

  /** Run a mutation, then refresh the relevant list. Surfaces failures inline. */
  async function run(op: () => Promise<unknown>, reload: () => void) {
    setError(null)
    try {
      await op()
      reload()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <>
      <TopBar
        title={facility?.name ?? 'Facility'}
        subtitle="Manage permits and monthly limits"
        leading={
          <button
            type="button"
            className="icon-button topbar-back"
            aria-label="Back to facilities"
            onClick={onBack}
          >
            <ArrowLeftIcon />
          </button>
        }
      />

      <div className="screen">
        {error && <div className="auth-alert">Error: {error}</div>}

        {facility === undefined && <p className="muted">Loading facility…</p>}
        {facility === null && <p className="muted">Facility not found.</p>}

        {facility && (
          <Tabs
            ariaLabel="Facility sections"
            tabs={[
              {
                id: 'permits',
                label: 'Permits',
                content: (
                  <PermitsPanel
                    permits={permits}
                    onAdd={(permit) =>
                      run(() => api.addPermit(accessToken, facilityId, permit), reloadPermits)
                    }
                    onDelete={(permit) =>
                      run(() => api.removePermit(accessToken, facilityId, permit.id), reloadPermits)
                    }
                  />
                ),
              },
              {
                id: 'limits',
                label: 'Monthly Limits',
                content: (
                  <LimitsPanel
                    limits={limits}
                    onAdd={(limit) =>
                      run(() => api.addLimit(accessToken, facilityId, limit), reloadLimits)
                    }
                    onUpdate={(emissionType, value) =>
                      run(
                        () => api.updateLimit(accessToken, facilityId, emissionType, value),
                        reloadLimits,
                      )
                    }
                    onDelete={(emissionType) =>
                      run(() => api.removeLimit(accessToken, facilityId, emissionType), reloadLimits)
                    }
                  />
                ),
              },
            ]}
          />
        )}
      </div>
    </>
  )
}

/**
 * Permits tab. A {@link GridControl} listing permits; the "+" opens a blank,
 * editable row inline (add). Permits are add/delete only — existing rows show no
 * Edit (only Delete); to change a permit, delete and re-add.
 */
function PermitsPanel({
  permits,
  onAdd,
  onDelete,
}: {
  permits: Permit[] | null
  onAdd: (permit: { expirationDate: string; value: string }) => void
  onDelete: (permit: Permit) => void
}) {
  const columns: GridColumn<Permit>[] = [
    {
      key: 'value',
      header: 'Permit number',
      editable: true,
      validate: (v) => (String(v ?? '').trim() === '' ? 'Permit number is required' : undefined),
      editor: ({ draft, error, onChange }) => (
        <input
          type="text"
          className="grid-control-editor"
          aria-label="Permit number"
          aria-invalid={error ? true : undefined}
          placeholder="e.g. 123-45678"
          value={String(draft ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'expirationDate',
      header: 'Expiration',
      editable: true,
      validate: (v) =>
        String(v ?? '').trim() === '' ? 'Expiration date is required' : undefined,
      editor: ({ draft, error, onChange }) => (
        <DatePicker
          value={String(draft ?? '')}
          onChange={(iso) => onChange(iso)}
          ariaLabel="Permit expiration date"
          invalid={!!error}
          className="grid-control-editor"
        />
      ),
    },
  ]

  return (
    <GridControl
      columns={columns}
      rows={permits ?? []}
      rowKey={(p) => p.id}
      loading={permits === null}
      ariaLabel="Permits"
      emptyText="No permits yet."
      editing={{
        onRowSave: (row) => onAdd({ expirationDate: row.expirationDate, value: row.value.trim() }),
        newRow: () => ({ id: NEW_ROW_ID, expirationDate: '', value: '' }),
        addLabel: 'Add permit',
        // Existing permits are never edited in place — only the "+" new row is editable.
        rowEditable: () => false,
        rowActions: (permit) =>
          permit.id === NEW_ROW_ID ? null : (
            <button
              type="button"
              className="button button-danger button-sm"
              aria-label={`Delete permit ${permit.value}`}
              onClick={() => onDelete(permit)}
            >
              Delete
            </button>
          ),
      }}
    />
  )
}

/** Grid view-model for a Monthly Limit, plus the unsaved-row marker. */
interface LimitRow {
  /** The pollutant; chosen on the new row, fixed (identity) on existing rows. */
  emissionType: EmissionType
  /** Tons/month cap; held as an empty string on the new row until entered. */
  value: number | ''
  /** True only for the unsaved row opened by the grid's "+". */
  isNew?: boolean
}

/**
 * Monthly Limits tab. A {@link GridControl} listing limits with inline value
 * edit + delete; the "+" opens a blank row whose Emission Type is a `<select>`
 * of the still-unused types (one limit per type, I-D19). On an existing row the
 * Emission Type is fixed — only its value is editable.
 */
function LimitsPanel({
  limits,
  onAdd,
  onUpdate,
  onDelete,
}: {
  limits: MonthlyLimit[] | null
  onAdd: (limit: { emissionType: EmissionType; value: number }) => void
  onUpdate: (emissionType: EmissionType, value: number) => void
  onDelete: (emissionType: EmissionType) => void
}) {
  const used = new Set((limits ?? []).map((l) => l.emissionType))
  const available = EMISSION_TYPES.filter((type) => !used.has(type))
  const firstAvailable = available[0]

  const columns: GridColumn<LimitRow>[] = [
    {
      key: 'emissionType',
      header: 'Emission Type',
      editable: true,
      validate: (v) => (v ? undefined : 'Select an emission type'),
      editor: ({ row, draft, error, onChange }) => {
        // Emission Type is the limit's identity: a select on the new row, fixed text otherwise.
        if (!(row as LimitRow).isNew) return <span>{String(draft ?? '')}</span>
        return (
          <select
            className="grid-control-editor"
            aria-label="Emission type"
            aria-invalid={error ? true : undefined}
            value={String(draft ?? '')}
            onChange={(e) => onChange(e.target.value)}
          >
            {available.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        )
      },
    },
    {
      key: 'value',
      header: 'Tons / month',
      align: 'right',
      accessor: (l) => (typeof l.value === 'number' ? TONS_FORMAT.format(l.value) : ''),
      editable: true,
      validate: (v) => (Number(v) > 0 ? undefined : 'Must be greater than 0'),
      editor: ({ draft, error, onChange }) => (
        <input
          type="number"
          min="0"
          step="any"
          className="grid-control-editor"
          aria-label="Tons / month"
          aria-invalid={error ? true : undefined}
          value={String(draft ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
  ]

  const rows: LimitRow[] = (limits ?? []).map((l) => ({ ...l }))

  return (
    <GridControl
      columns={columns}
      rows={rows}
      rowKey={(l) => (l.isNew ? NEW_ROW_ID : l.emissionType)}
      loading={limits === null}
      ariaLabel="Monthly limits"
      emptyText="No monthly limits yet."
      editing={{
        onRowSave: (row) => {
          if (row.isNew) onAdd({ emissionType: row.emissionType, value: Number(row.value) })
          else onUpdate(row.emissionType, Number(row.value))
        },
        rowActions: (limit) =>
          limit.isNew ? null : (
            <button
              type="button"
              className="button button-danger button-sm"
              aria-label={`Delete ${limit.emissionType} limit`}
              onClick={() => onDelete(limit.emissionType)}
            >
              Delete
            </button>
          ),
        // Offer the inline "+" only while some Emission Type is still unused.
        ...(firstAvailable
          ? {
              newRow: (): LimitRow => ({ emissionType: firstAvailable, value: '', isNew: true }),
              addLabel: 'Add limit',
            }
          : {}),
      }}
    />
  )
}
