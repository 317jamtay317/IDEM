import { useState } from 'react'
import {
  facilities,
  fieldOptions,
  productionEntries,
  type ProductionEntry,
} from '../data'
import { TopBar } from '../components/TopBar'
import { ChevronDownIcon, CloseIcon, PlusIcon } from '../components/icons'

let nextId = 100

/**
 * Log a Record screen: choose a Facility and date, then enter production
 * tonnage per field. Entries can be added, edited and removed. On tablet and
 * desktop the form is presented as a centred card. Saving is a no-op in the
 * prototype.
 */
export function LogRecordScreen() {
  const [entries, setEntries] = useState<ProductionEntry[]>(() =>
    productionEntries.map((e) => ({ ...e })),
  )

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
                  <div className="select">
                    <select
                      value={entry.field}
                      onChange={(e) => updateField(entry.id, e.target.value)}
                      aria-label="Field"
                    >
                      {fieldOptions.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDownIcon className="select-chevron" />
                  </div>
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
