import { useEffect, useState } from 'react'
import {
  facilities,
  fieldOptions as defaultFieldOptions,
  productionEntries,
  type ProductionEntry,
} from '../data'
import { productionFieldsApi as defaultApi, type ProductionFieldsApi } from '../productionFieldsApi'
import { TopBar } from '../components/TopBar'
import { SearchableSelect } from '../components/SearchableSelect'
import { ChevronDownIcon, CloseIcon, PlusIcon } from '../components/icons'

let nextId = 100

/** Props for {@link LogRecordScreen}. */
export interface LogRecordScreenProps {
  /** Bearer token; when present the field picker loads the live Production Field catalog. */
  accessToken?: string | null
  /** Catalog client; injectable for tests. Defaults to the live `fetch` client. */
  api?: ProductionFieldsApi
}

/**
 * Log a Record screen: choose a Facility and date, then enter production
 * tonnage per field. Entries can be added, edited and removed. On tablet and
 * desktop the form is presented as a centred card. The field picker offers the
 * live, SiteAdmin-managed Production Field catalog when authenticated, falling
 * back to a static sample list otherwise. Saving is a no-op in the prototype.
 */
export function LogRecordScreen({ accessToken = null, api = defaultApi }: LogRecordScreenProps = {}) {
  const [entries, setEntries] = useState<ProductionEntry[]>(() =>
    productionEntries.map((e) => ({ ...e })),
  )

  // Live catalog field labels when authenticated; the static sample list otherwise (prototype/tests).
  const [fieldOptions, setFieldOptions] = useState<string[]>(defaultFieldOptions)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    api
      .list(accessToken)
      .then((fields) => {
        if (!cancelled && fields.length > 0) setFieldOptions(fields.map((f) => f.friendlyName))
      })
      .catch(() => {
        // Keep the static fallback if the catalog can't be loaded.
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, api])

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
                <select defaultValue={facilities[0].name}>
                  {facilities.map((f) => (
                    <option key={f.id}>{f.name}</option>
                  ))}
                </select>
                <ChevronDownIcon className="select-chevron" />
              </div>
            </label>

            <label className="field">
              <span className="field-label">Date</span>
              <div className="select">
                <select defaultValue="May 29, 2026">
                  <option>May 29, 2026</option>
                  <option>May 28, 2026</option>
                  <option>May 27, 2026</option>
                </select>
                <ChevronDownIcon className="select-chevron" />
              </div>
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

            <button type="button" className="button button-primary button-block">
              Save record
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
