import { useCallback, useEffect, useState } from 'react'
import type { OrgSummary } from '../data'
import { orgsApi as defaultApi, type OrgsApi } from '../orgsApi'
import { GridControl, type GridColumn } from '../components/GridControl'
import { TopBar } from '../components/TopBar'
import { useBreakpoint } from '../useBreakpoint'

/** Sentinel id used for the unsaved "new org" row added inline in the grid. */
const NEW_ROW_ID = '__new__'

/** Props for {@link OrgsScreen}. */
export interface OrgsScreenProps {
  /** Bearer access token used to authorize the Org requests. */
  accessToken: string | null
  /**
   * CRUD operations for Orgs. Defaults to the live `fetch`-backed client;
   * injectable so tests can drive the screen without a network or auth provider.
   */
  api?: OrgsApi
}

/** True for the unsaved row created by the grid's add button. */
function isNew(org: OrgSummary): boolean {
  return org.id === NEW_ROW_ID
}

/**
 * Organizations screen — platform-wide Org management for SiteAdmins (I-D13).
 * The Org list is an editable {@link GridControl}: "Add organization" inserts a
 * blank row and opens it inline to enter a name (create); "Edit" on an existing
 * row inline-edits its Entra ID tenant id (configure SSO — the only mutable field,
 * since the API rejects renames); "Delete" removes it. Renders the grid on desktop
 * and editable cards on mobile/tablet. Authorization is deferred app-wide, so the
 * screen is reachable by any signed-in user for now; a later roles session gates it.
 */
export function OrgsScreen({ accessToken, api = defaultApi }: OrgsScreenProps) {
  const { isDesktop } = useBreakpoint()
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    let cancelled = false
    api
      .list(accessToken)
      .then((data) => {
        if (!cancelled) setOrgs(data)
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

  /** Save handler from the grid: create a new row, or update an existing row's SSO. */
  function handleRowSave(row: OrgSummary) {
    if (isNew(row)) {
      const name = row.name.trim()
      if (name.length === 0) return
      void run(() => api.create(accessToken, name))
    } else {
      const tenantId = row.tenantId && String(row.tenantId).trim().length > 0 ? String(row.tenantId).trim() : null
      void run(() => api.update(accessToken, row.id, row.name, tenantId))
    }
  }

  function handleDelete(org: OrgSummary) {
    void run(() => api.remove(accessToken, org.id))
  }

  const columns: GridColumn<OrgSummary>[] = [
    {
      key: 'name',
      header: 'Organization',
      // Editable only while the row is new (create). Existing Orgs cannot be renamed.
      editable: true,
      validate: (value, draft) =>
        isNew(draft) && String(value ?? '').trim().length === 0
          ? 'Name is required'
          : undefined,
      editor: ({ draft, row, error, onChange }) => {
        // For existing rows the name is fixed; show it read-only in edit mode.
        if (!isNew(row as OrgSummary)) {
          return <span className="cell-strong">{String((row as OrgSummary).name ?? '')}</span>
        }
        return (
          <input
            className="grid-control-editor"
            aria-label="Organization name"
            aria-invalid={error ? true : undefined}
            placeholder="e.g. Rieth-Riley"
            value={String(draft ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      },
      render: (o) => <span className="cell-strong">{o.name}</span>,
    },
    { key: 'facilities', header: 'Facilities', align: 'right', render: (o) => o.facilities.length },
    {
      key: 'tenantId',
      header: 'SSO (Entra tenant ID)',
      // Editable on existing rows only (configure SSO); blank for a brand-new Org.
      editable: true,
      editor: ({ draft, row, onChange }) => {
        if (isNew(row as OrgSummary)) return <span className="muted">Local</span>
        return (
          <input
            className="grid-control-editor"
            aria-label="Tenant ID"
            placeholder="Entra directory GUID (blank = Local)"
            value={String(draft ?? '')}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      },
      render: (o) => (o.tenantId ? 'Entra ID' : <span className="muted">Local</span>),
    },
  ]

  return (
    <>
      <TopBar title="Organizations" subtitle="Manage Orgs across the platform" />

      <div className="screen">
        {error && <div className="auth-alert">Error: {error}</div>}

        {orgs === null && !error && <p className="muted">Loading organizations…</p>}

        {orgs !== null && (
          isDesktop ? (
            <div className="card table-card">
              <GridControl
                columns={columns}
                rows={orgs}
                rowKey={(o) => o.id}
                ariaLabel="Organizations"
                emptyText="No organizations yet."
                editing={{
                  onRowSave: handleRowSave,
                  newRow: () => ({ id: NEW_ROW_ID, name: '', tenantId: null, facilities: [] }),
                  addLabel: 'Add organization',
                  rowActions: (o) =>
                    isNew(o) ? null : (
                      <button
                        type="button"
                        className="button button-danger button-sm"
                        onClick={() => handleDelete(o)}
                      >
                        Delete
                      </button>
                    ),
                  editLabel: (o) => (isNew(o) ? 'Edit' : 'Configure SSO'),
                }}
              />
            </div>
          ) : (
            <OrgCardList
              orgs={orgs}
              onCreate={(name) => run(() => api.create(accessToken, name))}
              onSaveSso={(o, tenantId) => run(() => api.update(accessToken, o.id, o.name, tenantId))}
              onDelete={handleDelete}
            />
          )
        )}
      </div>
    </>
  )
}

/** Mobile/tablet equivalent: cards with an add form and per-card inline SSO edit. */
function OrgCardList({
  orgs,
  onCreate,
  onSaveSso,
  onDelete,
}: {
  orgs: OrgSummary[]
  onCreate: (name: string) => void
  onSaveSso: (org: OrgSummary, tenantId: string | null) => void
  onDelete: (org: OrgSummary) => void
}) {
  const [newName, setNewName] = useState('')
  const trimmed = newName.trim()

  return (
    <div className="card-list">
      <div className="card">
        <label className="field">
          <span className="field-label">New organization</span>
          <input
            type="text"
            aria-label="Organization name"
            placeholder="e.g. Rieth-Riley"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button-primary button-block"
          disabled={trimmed.length === 0}
          onClick={() => {
            onCreate(trimmed)
            setNewName('')
          }}
        >
          Add organization
        </button>
      </div>

      {orgs.length === 0 && <p className="muted">No organizations yet.</p>}

      {orgs.map((o) => (
        <OrgCard key={o.id} org={o} onSaveSso={onSaveSso} onDelete={onDelete} />
      ))}
    </div>
  )
}

/** A single Org card with inline SSO editing and delete (mobile and tablet). */
function OrgCard({
  org,
  onSaveSso,
  onDelete,
}: {
  org: OrgSummary
  onSaveSso: (org: OrgSummary, tenantId: string | null) => void
  onDelete: (org: OrgSummary) => void
}) {
  const [editing, setEditing] = useState(false)
  const [tenantId, setTenantId] = useState(org.tenantId ?? '')

  return (
    <div className="card">
      <div className="record-head">
        <div className="facility-summary-heading">
          <span className="card-title">{org.name}</span>
          <span className="muted">
            {org.facilities.length} {org.facilities.length === 1 ? 'facility' : 'facilities'} ·{' '}
            {org.tenantId ? 'Entra ID' : 'Local'}
          </span>
        </div>
      </div>

      {editing ? (
        <>
          <label className="field">
            <span className="field-label">Tenant ID</span>
            <input
              type="text"
              aria-label="Tenant ID"
              placeholder="Entra directory GUID (blank = Local)"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            />
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="button button-primary button-sm"
              onClick={() => {
                onSaveSso(org, tenantId.trim().length > 0 ? tenantId.trim() : null)
                setEditing(false)
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => {
                setTenantId(org.tenantId ?? '')
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
            Configure SSO
          </button>
          <button
            type="button"
            className="button button-danger button-sm"
            onClick={() => onDelete(org)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
