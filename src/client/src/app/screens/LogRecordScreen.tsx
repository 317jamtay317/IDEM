import { useEffect, useState } from 'react'
import {
  facilities,
  fieldOptions as defaultFieldOptions,
  productionEntries,
  type ProductionEntry,
} from '../data'
import {
  productionFieldsApi as defaultApi,
  type ProductionField,
  type ProductionFieldsApi,
} from '../productionFieldsApi'
import { myFacilitiesApi as defaultFacilitiesApi, type MyFacilitiesApi, type MyFacility } from '../myFacilitiesApi'
import { recordsApi as defaultRecordsApi, type RecordsApi, type RecordValueInput } from '../recordsApi'
import { TopBar } from '../components/TopBar'
import { SearchableSelect } from '../components/SearchableSelect'
import { ChevronDownIcon, CloseIcon, PlusIcon } from '../components/icons'

let nextId = 100

/** Today as `yyyy-MM-dd`, the default date for a new Record. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Outcome of the most recent save attempt. */
type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string }

/** Props for {@link LogRecordScreen}. */
export interface LogRecordScreenProps {
  /** Bearer token; when present the screen loads the live catalog and Facilities, and Save persists. */
  accessToken?: string | null
  /** Catalog client; injectable for tests. Defaults to the live `fetch` client. */
  api?: ProductionFieldsApi
  /** Facilities client; injectable for tests. Defaults to the live `fetch` client. */
  facilitiesApi?: MyFacilitiesApi
  /** Records client; injectable for tests. Defaults to the live `fetch` client. */
  recordsApi?: RecordsApi
}

/**
 * Log a Record screen: choose a Facility and date, then enter a value per field. Entries can be
 * added, edited and removed. When authenticated the Facility selector and field picker load live
 * data (the Org's Facilities and the SiteAdmin-managed Production Field catalog), and Save persists
 * the Record via `POST /me/org/records`; without a token the screen shows the static sample data and
 * Save is inert. Each entry's value is sent under the column its field's DataType dictates.
 */
export function LogRecordScreen({
  accessToken = null,
  api = defaultApi,
  facilitiesApi = defaultFacilitiesApi,
  recordsApi = defaultRecordsApi,
}: LogRecordScreenProps = {}) {
  const [entries, setEntries] = useState<ProductionEntry[]>(() =>
    productionEntries.map((e) => ({ ...e })),
  )

  // The live catalog when authenticated; empty (static fallback) otherwise.
  const [catalog, setCatalog] = useState<ProductionField[]>([])
  const fieldOptions = catalog.length > 0 ? catalog.map((f) => f.friendlyName) : defaultFieldOptions

  const [liveFacilities, setLiveFacilities] = useState<MyFacility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [date, setDate] = useState<string>(todayIso)
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    api
      .list(accessToken)
      .then((fields) => {
        if (!cancelled && fields.length > 0) setCatalog(fields)
      })
      .catch(() => {
        // Keep the static fallback if the catalog can't be loaded.
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, api])

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    facilitiesApi
      .list(accessToken)
      .then((facs) => {
        if (!cancelled && facs.length > 0) {
          setLiveFacilities(facs)
          setSelectedFacilityId(facs[0].id)
        }
      })
      .catch(() => {
        // Keep the static Facility list if the live ones can't be loaded.
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, facilitiesApi])

  function updateTons(id: string, value: number) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, tons: value } : e)))
  }

  function updateField(id: string, field: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, field } : e)))
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function addEntry() {
    setEntries((prev) => [
      ...prev,
      { id: `p${(nextId += 1)}`, field: fieldOptions[0], tons: 0, limit: 1000 },
    ])
  }

  // Map each entry onto a catalog field and place its value in the column the field's DataType
  // dictates. Entries whose field is not in the live catalog (or whose Date fields the numeric form
  // cannot capture) are skipped.
  function buildValues(): RecordValueInput[] {
    const values: RecordValueInput[] = []
    for (const entry of entries) {
      const field = catalog.find((f) => f.friendlyName === entry.field)
      if (!field) continue
      if (field.dataType === 'Decimal' || field.dataType === 'Integer') {
        values.push({ propertyName: field.propertyName, numericValue: entry.tons })
      } else if (field.dataType === 'Boolean') {
        values.push({ propertyName: field.propertyName, booleanValue: entry.tons !== 0 })
      }
    }
    return values
  }

  async function onSave() {
    if (!accessToken || !selectedFacilityId) return
    setSaveState({ status: 'saving' })
    try {
      await recordsApi.create(accessToken, {
        facilityId: selectedFacilityId,
        date,
        values: buildValues(),
      })
      setSaveState({ status: 'saved' })
    } catch (error) {
      setSaveState({ status: 'error', message: error instanceof Error ? error.message : 'Save failed' })
    }
  }

  return (
    <>
      <TopBar title="Log a Record" subtitle="Save a compliance record" />

      <div className="screen screen-form">
        <div className="form-card">
          <h2 className="form-card-title">New production record</h2>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Facility</span>
              <div className="select">
                {liveFacilities.length > 0 ? (
                  <select
                    aria-label="Facility"
                    value={selectedFacilityId}
                    onChange={(e) => setSelectedFacilityId(e.target.value)}
                  >
                    {liveFacilities.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select aria-label="Facility" defaultValue={facilities[0].name}>
                    {facilities.map((f) => (
                      <option key={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}
                <ChevronDownIcon className="select-chevron" />
              </div>
            </label>

            <label className="field">
              <span className="field-label">Date</span>
              <input
                type="date"
                className="date-input"
                aria-label="Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>

          <h2 className="section-title">Production entries</h2>
          <p className="muted entries-hint">New fields default to 0 · tap a value to edit</p>

          <div className="card entries-table">
            <div className="entries-header">
              <span className="overline">Field</span>
              <span className="overline entries-header-tons">Tons</span>
            </div>

            {entries.map((entry) => (
              <div key={entry.id} className="entry-row">
                <div className="entry-main">
                  <SearchableSelect
                    options={fieldOptions}
                    value={entry.field}
                    onChange={(field) => updateField(entry.id, field)}
                    label="Field"
                    searchPlaceholder="Search fields…"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    className="tons-input"
                    aria-label={`${entry.field} tons`}
                    value={entry.tons}
                    onChange={(e) => updateTons(entry.id, Number(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${entry.field}`}
                    onClick={() => removeEntry(entry.id)}
                  >
                    <CloseIcon className="entry-remove" />
                  </button>
                </div>
                <span className="muted entry-limit">
                  {facilities[0].name.split(' ')[0]} limit: {entry.limit.toLocaleString()} tons/day
                </span>
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary button-block"
              onClick={addEntry}
            >
              <PlusIcon className="button-icon" />
              Add field
            </button>

            <button
              type="button"
              className="button button-primary button-block"
              onClick={onSave}
              disabled={saveState.status === 'saving'}
            >
              Save record
            </button>

            {saveState.status === 'saved' && (
              <p className="form-status" role="status">
                Record saved
              </p>
            )}
            {saveState.status === 'error' && (
              <p className="form-status form-status-error" role="alert">
                {saveState.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
