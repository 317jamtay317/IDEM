import { useEffect, useState } from 'react'
import {
  productionFieldsApi as defaultApi,
  type ProductionField,
  type ProductionFieldsApi,
} from '../productionFieldsApi'
import { myFacilitiesApi as defaultFacilitiesApi, type MyFacilitiesApi, type MyFacility } from '../myFacilitiesApi'
import { recordsApi as defaultRecordsApi, type RecordsApi, type RecordValueInput } from '../recordsApi'
import { TopBar } from '../components/TopBar'
import { SearchableSelect } from '../components/SearchableSelect'
import { DatePicker } from '../components/DatePicker'
import { CloseIcon, PlusIcon } from '../components/icons'

let nextId = 100

/** Today as `yyyy-MM-dd`, the default date for a new Record. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * One field a user is recording. `value` is held as a string while editing and
 * coerced to the field's typed value at save time: a number for Decimal/Integer,
 * a `'true'`/`'false'` flag for Boolean, an ISO `yyyy-MM-dd` string for Date.
 */
interface Entry {
  /** Stable row id. */
  id: string
  /** The chosen Production Field's immutable key (I-D21). */
  propertyName: string
  /** The in-progress value, interpreted by the field's DataType at save time. */
  value: string
}

/** The empty editing value for a field of the given DataType. */
function emptyValueFor(dataType: ProductionField['dataType']): string {
  return dataType === 'Boolean' ? 'false' : ''
}

/** Outcome of the most recent save attempt. */
type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string }

/** Props for {@link LogRecordScreen}. */
export interface LogRecordScreenProps {
  /** Bearer token; required to load the Org's Facilities and catalog and to persist a Record. */
  accessToken?: string | null
  /** Catalog client; injectable for tests. Defaults to the live `fetch` client. */
  api?: ProductionFieldsApi
  /** Facilities client; injectable for tests. Defaults to the live `fetch` client. */
  facilitiesApi?: MyFacilitiesApi
  /** Records client; injectable for tests. Defaults to the live `fetch` client. */
  recordsApi?: RecordsApi
  /** Navigates to the Facilities screen, offered when the Org has no Facility yet. */
  onManageFacilities?: () => void
}

/**
 * Log a Record screen: choose one of the Org's Facilities and a date, then add a value for each
 * Production Field being recorded. The Facility list and field catalog are the Org's own live data
 * (I-D03); each value's editor matches its field's DataType (a number for Decimal/Integer, a Yes/No
 * toggle for Boolean, a date for Date), and Save persists the Record via `POST /me/org/records`.
 * When the Org has no Facility yet the screen guides the user to add one first rather than offering a
 * dead Save.
 */
export function LogRecordScreen({
  accessToken = null,
  api = defaultApi,
  facilitiesApi = defaultFacilitiesApi,
  recordsApi = defaultRecordsApi,
  onManageFacilities,
}: LogRecordScreenProps = {}) {
  // The Org's active Production Field catalog and Facilities, loaded when authenticated.
  // `facilities === null` means "still loading"; `[]` means "loaded, the Org has none".
  const [catalog, setCatalog] = useState<ProductionField[]>([])
  const [facilities, setFacilities] = useState<MyFacility[] | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [date, setDate] = useState<string>(todayIso)
  const [entries, setEntries] = useState<Entry[]>([])
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })

  const fieldByProperty = new Map(catalog.map((field) => [field.propertyName, field]))
  const usedPropertyNames = entries.map((entry) => entry.propertyName)
  const firstUnusedField = catalog.find((field) => !usedPropertyNames.includes(field.propertyName))
  const facilityOptions = (facilities ?? []).map((facility) => ({ value: facility.id, label: facility.name }))
  const selectedFacility = selectedFacilityId || facilityOptions[0]?.value || ''

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    api
      .list(accessToken)
      .then((fields) => {
        if (!cancelled) setCatalog(fields)
      })
      .catch(() => {
        // Leave the catalog empty; the user simply can't add fields until it loads.
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
        if (cancelled) return
        setFacilities(facs)
        if (facs.length > 0) setSelectedFacilityId(facs[0].id)
      })
      .catch(() => {
        if (!cancelled) setFacilities([])
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, facilitiesApi])

  function addField() {
    if (!firstUnusedField) return
    setEntries((prev) => [
      ...prev,
      { id: `e${(nextId += 1)}`, propertyName: firstUnusedField.propertyName, value: emptyValueFor(firstUnusedField.dataType) },
    ])
  }

  function chooseField(id: string, propertyName: string) {
    const field = fieldByProperty.get(propertyName)
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, propertyName, value: emptyValueFor(field?.dataType ?? 'Decimal') }
          : entry,
      ),
    )
  }

  function setValue(id: string, value: string) {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, value } : entry)))
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  // Coerce each entry to the typed value its field's DataType dictates. Entries whose field is no
  // longer in the catalog, and empty Date entries, are skipped.
  function buildValues(): RecordValueInput[] {
    const values: RecordValueInput[] = []
    for (const entry of entries) {
      const field = fieldByProperty.get(entry.propertyName)
      if (!field) continue
      switch (field.dataType) {
        case 'Decimal':
        case 'Integer':
          values.push({ propertyName: field.propertyName, numericValue: Number(entry.value) || 0 })
          break
        case 'Boolean':
          values.push({ propertyName: field.propertyName, booleanValue: entry.value === 'true' })
          break
        case 'Date':
          if (entry.value) values.push({ propertyName: field.propertyName, dateValue: entry.value })
          break
      }
    }
    return values
  }

  async function onSave() {
    if (!accessToken || !selectedFacility) return
    setSaveState({ status: 'saving' })
    try {
      await recordsApi.create(accessToken, {
        facilityId: selectedFacility,
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

          {!accessToken ? (
            <p className="muted">Sign in to log a record.</p>
          ) : facilities === null ? (
            <p className="muted">Loading…</p>
          ) : facilities.length === 0 ? (
            <div className="form-empty">
              <p className="muted">Add a Facility before you can log a record.</p>
              <button
                type="button"
                className="button button-primary"
                onClick={() => onManageFacilities?.()}
              >
                Go to Facilities
              </button>
            </div>
          ) : (
            <>
              <div className="field-row">
                <div className="field">
                  <span className="field-label">Facility</span>
                  <SearchableSelect
                    label="Facility"
                    options={facilityOptions}
                    value={selectedFacility}
                    onChange={setSelectedFacilityId}
                    searchPlaceholder="Search facilities…"
                  />
                </div>

                <div className="field">
                  <span className="field-label">Date</span>
                  <DatePicker value={date} onChange={setDate} ariaLabel="Date" />
                </div>
              </div>

              <h2 className="section-title">Production entries</h2>
              <p className="muted entries-hint">Add a field for each measurement you want to record.</p>

              <div className="card entries-table">
                {entries.length === 0 ? (
                  <p className="muted entries-empty">No fields added yet.</p>
                ) : (
                  entries.map((entry) => {
                    const field = fieldByProperty.get(entry.propertyName)
                    const fieldOptions = catalog
                      .filter(
                        (f) =>
                          f.propertyName === entry.propertyName ||
                          !usedPropertyNames.includes(f.propertyName),
                      )
                      .map((f) => ({ value: f.propertyName, label: f.friendlyName }))
                    return (
                      <div key={entry.id} className="entry-row">
                        <div className="entry-main">
                          <SearchableSelect
                            label="Field"
                            options={fieldOptions}
                            value={entry.propertyName}
                            onChange={(propertyName) => chooseField(entry.id, propertyName)}
                            searchPlaceholder="Search fields…"
                          />
                          <EntryValueEditor entry={entry} field={field} onChange={(v) => setValue(entry.id, v)} />
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Remove ${field?.friendlyName ?? 'field'}`}
                            onClick={() => removeEntry(entry.id)}
                          >
                            <CloseIcon className="entry-remove" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary button-block"
                  onClick={addField}
                  disabled={!firstUnusedField}
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
            </>
          )}
        </div>
      </div>
    </>
  )
}

/** Props for {@link EntryValueEditor}. */
interface EntryValueEditorProps {
  /** The entry being edited. */
  entry: Entry
  /** The catalog field the entry records, or `undefined` if it is not (yet) resolved. */
  field: ProductionField | undefined
  /** Reports the new value as the string the row stores. */
  onChange: (value: string) => void
}

/**
 * The value editor for a single production entry, chosen by the field's DataType: a number input for
 * Decimal/Integer, a Yes/No checkbox for Boolean, and a {@link DatePicker} for Date.
 */
function EntryValueEditor({ entry, field, onChange }: EntryValueEditorProps) {
  const label = field?.friendlyName ?? 'Value'

  if (field?.dataType === 'Boolean') {
    const checked = entry.value === 'true'
    return (
      <label className="entry-boolean">
        <input
          type="checkbox"
          aria-label={label}
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
        />
        <span>{checked ? 'Yes' : 'No'}</span>
      </label>
    )
  }

  if (field?.dataType === 'Date') {
    return (
      <DatePicker
        value={entry.value}
        onChange={onChange}
        ariaLabel={`${label} date`}
        className="entry-date"
      />
    )
  }

  return (
    <input
      type="number"
      inputMode={field?.dataType === 'Integer' ? 'numeric' : 'decimal'}
      className="tons-input"
      aria-label={`${label} value`}
      value={entry.value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
