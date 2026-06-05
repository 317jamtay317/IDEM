import { useEffect, useMemo, useState } from 'react'
import {
  myFacilitiesApi as defaultFacilitiesApi,
  type MyFacilitiesApi,
  type MyFacility,
} from '../myFacilitiesApi'
import {
  productionFieldsApi as defaultFieldsApi,
  type ProductionField,
  type ProductionFieldsApi,
} from '../productionFieldsApi'
import { recordsApi as defaultRecordsApi, type LoggedRecord, type RecordsApi } from '../recordsApi'
import { GridControl, type GridColumn } from '../components/GridControl'
import { DatePicker } from '../components/DatePicker'
import { TopBar } from '../components/TopBar'
import { useBreakpoint } from '../useBreakpoint'

/** Props for {@link RecordsScreen}. */
export interface RecordsScreenProps {
  /** Bearer token used to authorize the read requests; Org scope is enforced server-side (I-D03). */
  accessToken?: string | null
  /** Facilities client; injectable for tests. Defaults to the live `fetch` client. */
  facilitiesApi?: MyFacilitiesApi
  /** Production Field catalog client (drives the drill-down columns); injectable for tests. */
  fieldsApi?: ProductionFieldsApi
  /** Records client; injectable for tests. Defaults to the live `fetch` client. */
  recordsApi?: RecordsApi
}

/**
 * Render a Record's value for a field as display text, formatted by the field's data type: a
 * thousands-separated number, "Yes"/"No", or the date string. A field the Record did not capture
 * (the values are sparse) renders as an em dash.
 */
function formatValue(field: ProductionField, record: LoggedRecord): string {
  const value = record.values.find((v) => v.propertyName === field.propertyName)
  if (!value) return '—'
  switch (field.dataType) {
    case 'Boolean':
      return value.booleanValue == null ? '—' : value.booleanValue ? 'Yes' : 'No'
    case 'Date':
      return value.dateValue ?? '—'
    default:
      return value.numericValue == null ? '—' : value.numericValue.toLocaleString('en-US')
  }
}

/**
 * The Exceedance direction for a field's value on a Record, or `null` when the value is within the
 * Org's configured range, has no limit, or is non-numeric. Only `Below`/`Above` are exceedances.
 */
function exceedanceOf(field: ProductionField, record: LoggedRecord): 'Below' | 'Above' | null {
  const ex = record.values.find((v) => v.propertyName === field.propertyName)?.exceedance
  return ex === 'Below' || ex === 'Above' ? ex : null
}

/**
 * A single drill-down cell. A value outside the Org's configured limit is shown in the danger colour
 * with a direction arrow (▲ above / ▼ below) and an accessible description; in-range and unlimited
 * values render as plain text.
 */
function ValueCell({ field, record }: { field: ProductionField; record: LoggedRecord }) {
  const text = formatValue(field, record)
  const exceedance = exceedanceOf(field, record)
  if (!exceedance) return <span>{text}</span>

  const label = exceedance === 'Above' ? 'Above the configured limit' : 'Below the configured limit'
  return (
    <span className={`cell-exceedance cell-exceedance-${exceedance.toLowerCase()}`} title={label}>
      {text}
      <span className="exceedance-arrow" aria-hidden="true">
        {exceedance === 'Above' ? '▲' : '▼'}
      </span>
      <span className="visually-hidden"> — {label}</span>
    </span>
  )
}

/**
 * Records screen. Level one lists the Org's Facilities (a {@link GridControl} table on desktop,
 * tappable cards on mobile/tablet); selecting one drills into that Facility's Records — a date plus a
 * column per catalog <em>Summary</em> field — filterable by a date range. Every read is scoped to the
 * caller's Org server-side from the token (I-D03); the screen never sends an Org id. Compliance roll-up
 * metrics (last ran, filing due dates, status) are a later slice and intentionally absent here.
 */
export function RecordsScreen({
  accessToken = null,
  facilitiesApi = defaultFacilitiesApi,
  fieldsApi = defaultFieldsApi,
  recordsApi = defaultRecordsApi,
}: RecordsScreenProps = {}) {
  const { isDesktop } = useBreakpoint()
  const [facilities, setFacilities] = useState<MyFacility[] | null>(null)
  const [catalog, setCatalog] = useState<ProductionField[]>([])
  const [selected, setSelected] = useState<MyFacility | null>(null)
  const [records, setRecords] = useState<LoggedRecord[] | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Level one: the Org's Facilities.
  useEffect(() => {
    let cancelled = false
    facilitiesApi
      .list(accessToken)
      .then((data) => {
        if (!cancelled) setFacilities(data)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, facilitiesApi])

  // The catalog drives which columns the drill-down shows; if it can't load, columns fall back to Date.
  useEffect(() => {
    let cancelled = false
    fieldsApi
      .list(accessToken)
      .then((data) => {
        if (!cancelled) setCatalog(data)
      })
      .catch(() => {
        // Degrade gracefully — the drill-down still lists Records by date.
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, fieldsApi])

  // Level two: the selected Facility's Records, reloaded as the date-range filter changes.
  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setRecords(null)
    recordsApi
      .list(accessToken, { facilityId: selected.id, from: from || undefined, to: to || undefined })
      .then((data) => {
        if (!cancelled) setRecords(data)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, selected, from, to, recordsApi])

  const summaryFields = useMemo(
    () => catalog.filter((f) => f.isSummary).sort((a, b) => a.displayOrder - b.displayOrder),
    [catalog],
  )

  if (selected) {
    const columns: GridColumn<LoggedRecord>[] = [
      { key: 'date', header: 'Date', render: (r) => <span className="cell-strong">{r.date}</span> },
      ...summaryFields.map<GridColumn<LoggedRecord>>((field) => ({
        key: field.propertyName,
        header: field.friendlyName,
        align: field.dataType === 'Decimal' || field.dataType === 'Integer' ? 'right' : undefined,
        render: (r) => <ValueCell field={field} record={r} />,
      })),
    ]

    return (
      <>
        <TopBar title={selected.name} subtitle="Records" />

        <div className="screen">
          <button
            type="button"
            className="button button-secondary records-back"
            onClick={() => setSelected(null)}
          >
            ← Back to facilities
          </button>

          {error && <div className="auth-alert">Error: {error}</div>}

          <div className="field-row">
            <div className="field">
              <span className="field-label">From</span>
              <DatePicker value={from} onChange={setFrom} ariaLabel="From" placeholder="Any" />
            </div>
            <div className="field">
              <span className="field-label">To</span>
              <DatePicker value={to} onChange={setTo} ariaLabel="To" placeholder="Any" />
            </div>
          </div>

          <div className="card table-card records-drilldown">
            <GridControl
              columns={columns}
              rows={records ?? []}
              rowKey={(r) => r.id}
              ariaLabel={`${selected.name} records`}
              loading={records === null}
              emptyText="No records found."
              paging={{ mode: 'client', pageSize: 10 }}
            />
          </div>
        </div>
      </>
    )
  }

  const facilityColumns: GridColumn<MyFacility>[] = [
    {
      key: 'name',
      header: 'Facility',
      render: (f) => (
        <button type="button" className="facility-link" onClick={() => setSelected(f)}>
          {f.name}
        </button>
      ),
    },
  ]

  return (
    <>
      <TopBar
        title="Records"
        subtitle={facilities ? `Facilities · ${facilities.length}` : 'Facilities'}
      />

      <div className="screen">
        <span className="group-label">Facilities</span>

        {error && <div className="auth-alert">Error: {error}</div>}

        {isDesktop ? (
          <div className="card table-card">
            <GridControl
              columns={facilityColumns}
              rows={facilities ?? []}
              rowKey={(f) => f.id}
              ariaLabel="Records"
              loading={facilities === null}
              emptyText="No facilities yet."
            />
          </div>
        ) : facilities === null ? (
          <p className="muted">Loading facilities…</p>
        ) : facilities.length === 0 ? (
          <p className="muted">No facilities yet.</p>
        ) : (
          <div className="card-list">
            {facilities.map((f) => (
              <button
                key={f.id}
                type="button"
                className="card facility-summary-card"
                onClick={() => setSelected(f)}
              >
                <div className="record-head">
                  <div className="facility-summary-heading">
                    <span className="card-title">{f.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
