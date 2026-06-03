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
 * Limits (I-D06). Every call is scoped server-side to the caller's Org via the
 * `org_id` claim (I-D03); the screen never sends an Org id. Mobile-first: rendered
 * as stacked cards on every breakpoint. The Facility itself is resolved from the
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
      />

      <div className="screen">
        <button
          type="button"
          className="button button-secondary button-sm"
          aria-label="Back to facilities"
          onClick={onBack}
        >
          ← Facilities
        </button>

        {error && <div className="auth-alert">Error: {error}</div>}

        {facility === undefined && <p className="muted">Loading facility…</p>}
        {facility === null && <p className="muted">Facility not found.</p>}

        {facility && (
          <>
            <PermitsSection
              permits={permits}
              onAdd={(permit) =>
                run(() => api.addPermit(accessToken, facilityId, permit), reloadPermits)
              }
              onDelete={(permit) =>
                run(() => api.removePermit(accessToken, facilityId, permit.id), reloadPermits)
              }
            />
            <LimitsSection
              limits={limits}
              onAdd={(limit) =>
                run(() => api.addLimit(accessToken, facilityId, limit), reloadLimits)
              }
              onUpdate={(emissionType, value) =>
                run(() => api.updateLimit(accessToken, facilityId, emissionType, value), reloadLimits)
              }
              onDelete={(limit) =>
                run(() => api.removeLimit(accessToken, facilityId, limit.emissionType), reloadLimits)
              }
            />
          </>
        )}
      </div>
    </>
  )
}

/** Permits section: list + add form + per-permit delete. Permits have no in-place edit. */
function PermitsSection({
  permits,
  onAdd,
  onDelete,
}: {
  permits: Permit[] | null
  onAdd: (permit: { expirationDate: string; value: string }) => void
  onDelete: (permit: Permit) => void
}) {
  const [expirationDate, setExpirationDate] = useState('')
  const [value, setValue] = useState('')
  const canAdd = expirationDate.trim() !== '' && value.trim() !== ''

  return (
    <section className="card-list">
      <h2 className="section-title">Permits</h2>

      <div className="card">
        <label className="field">
          <span className="field-label">Expiration date</span>
          <input
            type="date"
            aria-label="Permit expiration date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Permit number</span>
          <input
            type="text"
            aria-label="Permit number"
            placeholder="e.g. 123-45678"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button-primary button-block"
          disabled={!canAdd}
          onClick={() => {
            onAdd({ expirationDate, value: value.trim() })
            setExpirationDate('')
            setValue('')
          }}
        >
          Add permit
        </button>
      </div>

      {permits === null && <p className="muted">Loading permits…</p>}
      {permits !== null && permits.length === 0 && <p className="muted">No permits yet.</p>}
      {permits?.map((permit) => (
        <div className="card" key={permit.id}>
          <div className="record-head">
            <span className="card-title">{permit.value}</span>
          </div>
          <p className="muted">Expires {permit.expirationDate}</p>
          <div className="row-actions">
            <button
              type="button"
              className="button button-danger button-sm"
              aria-label={`Delete permit ${permit.value}`}
              onClick={() => onDelete(permit)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}

/** Monthly Limits section: list + add form + per-limit edit-value and delete. */
function LimitsSection({
  limits,
  onAdd,
  onUpdate,
  onDelete,
}: {
  limits: MonthlyLimit[] | null
  onAdd: (limit: { emissionType: EmissionType; value: number }) => void
  onUpdate: (emissionType: EmissionType, value: number) => void
  onDelete: (limit: MonthlyLimit) => void
}) {
  const [emissionType, setEmissionType] = useState<EmissionType>(EMISSION_TYPES[0])
  const [value, setValue] = useState('')
  const canAdd = value.trim() !== '' && Number(value) > 0

  return (
    <section className="card-list">
      <h2 className="section-title">Monthly Limits</h2>

      <div className="card">
        <label className="field">
          <span className="field-label">Emission type</span>
          <select
            aria-label="Emission type"
            value={emissionType}
            onChange={(e) => setEmissionType(e.target.value as EmissionType)}
          >
            {EMISSION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Limit value (tons per month)</span>
          <input
            type="number"
            min="0"
            step="any"
            aria-label="Limit value (tons per month)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button-primary button-block"
          disabled={!canAdd}
          onClick={() => {
            onAdd({ emissionType, value: Number(value) })
            setValue('')
          }}
        >
          Add limit
        </button>
      </div>

      {limits === null && <p className="muted">Loading limits…</p>}
      {limits !== null && limits.length === 0 && <p className="muted">No monthly limits yet.</p>}
      {limits?.map((limit) => (
        <LimitCard
          key={limit.emissionType}
          limit={limit}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </section>
  )
}

/** A single Monthly Limit card with inline value editing and delete. */
function LimitCard({
  limit,
  onUpdate,
  onDelete,
}: {
  limit: MonthlyLimit
  onUpdate: (emissionType: EmissionType, value: number) => void
  onDelete: (limit: MonthlyLimit) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(limit.value))
  const canSave = draft.trim() !== '' && Number(draft) > 0

  return (
    <div className="card">
      <div className="record-head">
        <span className="card-title">{limit.emissionType}</span>
        <span className="muted">{limit.value} tons/month</span>
      </div>

      {editing ? (
        <>
          <label className="field">
            <span className="field-label">New value (tons per month)</span>
            <input
              type="number"
              min="0"
              step="any"
              aria-label={`New value for ${limit.emissionType}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="button button-primary button-sm"
              disabled={!canSave}
              aria-label={`Save ${limit.emissionType} limit`}
              onClick={() => {
                onUpdate(limit.emissionType, Number(draft))
                setEditing(false)
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => {
                setDraft(String(limit.value))
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
            aria-label={`Edit ${limit.emissionType} limit`}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="button button-danger button-sm"
            aria-label={`Delete ${limit.emissionType} limit`}
            onClick={() => onDelete(limit)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
