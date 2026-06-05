import { useCallback, useEffect, useState } from 'react'
import {
  myFacilitiesApi as defaultApi,
  type MyFacilitiesApi,
  type MyFacility,
} from '../myFacilitiesApi'
import { GridControl, type GridColumn } from '../components/GridControl'
import { TopBar } from '../components/TopBar'
import { useBreakpoint } from '../useBreakpoint'

/** Sentinel id used for the unsaved "new facility" row added inline in the grid. */
const NEW_ROW_ID = '__new__'

/** Props for {@link FacilitiesScreen}. */
export interface FacilitiesScreenProps {
  /** Bearer access token used to authorize the Facility requests. */
  accessToken: string | null
  /**
   * CRUD operations for the caller's Facilities. Defaults to the live
   * `fetch`-backed client; injectable so tests can drive the screen without a
   * network or auth provider.
   */
  api?: MyFacilitiesApi
  /**
   * Opens a Facility's details page (where its Permits and Monthly Limits are
   * managed). Wired by the {@link AppShell} to the hash router; optional so the
   * screen can render standalone in tests.
   */
  onOpenFacility?: (id: string) => void
}

/** True for the unsaved row created by the grid's add button. */
function isNew(facility: MyFacility): boolean {
  return facility.id === NEW_ROW_ID
}

/**
 * Facilities screen — an Org User manages their own Org's Facilities (I-D06). The
 * list is an editable {@link GridControl}: "Add facility" inserts a blank row to
 * name (create); "Rename" inline-edits an existing Facility's name; "Delete"
 * removes it. Renders the grid on desktop and editable cards on mobile/tablet.
 * Every call is scoped server-side to the caller's Org via the `org_id` claim
 * (I-D03) — the screen never sends an Org id.
 */
export function FacilitiesScreen({
  accessToken,
  api = defaultApi,
  onOpenFacility,
}: FacilitiesScreenProps) {
  const { isDesktop } = useBreakpoint()
  const [facilities, setFacilities] = useState<MyFacility[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MyFacility | null>(null)

  const reload = useCallback(() => {
    let cancelled = false
    api
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

  /** Save handler from the grid: create a new row, or rename an existing one. */
  function handleRowSave(row: MyFacility) {
    const name = row.name.trim()
    if (name.length === 0) return
    if (isNew(row)) {
      void run(() => api.add(accessToken, name))
    } else {
      void run(() => api.rename(accessToken, row.id, name))
    }
  }

  /** Ask for confirmation before deleting; the delete itself runs on confirm. */
  function requestDelete(facility: MyFacility) {
    setPendingDelete(facility)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const facility = pendingDelete
    setPendingDelete(null)
    void run(() => api.remove(accessToken, facility.id))
  }

  function cancelDelete() {
    setPendingDelete(null)
  }

  const columns: GridColumn<MyFacility>[] = [
    {
      key: 'name',
      header: 'Facility',
      editable: true,
      validate: (value) =>
        String(value ?? '').trim().length === 0 ? 'Name is required' : undefined,
      editor: ({ draft, error, onChange }) => (
        <input
          className="grid-control-editor"
          aria-label="Facility name"
          aria-invalid={error ? true : undefined}
          placeholder="e.g. Goshen Plant"
          value={String(draft ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
      render: (f) => <span className="cell-strong">{f.name}</span>,
    },
  ]

  return (
    <>
      <TopBar title="Facilities" subtitle="Manage your organization's facilities" />

      <div className="screen">
        {error && <div className="auth-alert">Error: {error}</div>}

        {facilities === null && !error && <p className="muted">Loading facilities…</p>}

        {facilities !== null && (
          isDesktop ? (
            <div className="card table-card">
              <GridControl
                columns={columns}
                rows={facilities}
                rowKey={(f) => f.id}
                ariaLabel="Facilities"
                emptyText="No facilities yet."
                editing={{
                  onRowSave: handleRowSave,
                  newRow: () => ({ id: NEW_ROW_ID, name: '' }),
                  addLabel: 'Add facility',
                  rowActions: (f) =>
                    isNew(f) ? null : (
                      <>
                        <button
                          type="button"
                          className="button button-secondary button-sm"
                          onClick={() => onOpenFacility?.(f.id)}
                        >
                          Manage
                        </button>
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          onClick={() => requestDelete(f)}
                        >
                          Delete
                        </button>
                      </>
                    ),
                  editLabel: (f) => (isNew(f) ? 'Edit' : 'Rename'),
                }}
              />
            </div>
          ) : (
            <FacilityCardList
              facilities={facilities}
              onAdd={(name) => run(() => api.add(accessToken, name))}
              onRename={(f, name) => run(() => api.rename(accessToken, f.id, name))}
              onDelete={requestDelete}
              onOpen={(f) => onOpenFacility?.(f.id)}
            />
          )
        )}
      </div>

      {pendingDelete && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete facility"
        >
          <div className="card modal-card">
            <p className="modal-title">
              Are you sure you want to delete {pendingDelete.name}?
            </p>
            <div className="row-actions">
              <button type="button" className="button button-danger" onClick={confirmDelete}>
                Delete
              </button>
              <button type="button" className="button button-secondary" onClick={cancelDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Mobile/tablet equivalent: cards with an add form and per-card inline rename. */
function FacilityCardList({
  facilities,
  onAdd,
  onRename,
  onDelete,
  onOpen,
}: {
  facilities: MyFacility[]
  onAdd: (name: string) => void
  onRename: (facility: MyFacility, name: string) => void
  onDelete: (facility: MyFacility) => void
  onOpen: (facility: MyFacility) => void
}) {
  const [newName, setNewName] = useState('')
  const trimmed = newName.trim()

  return (
    <div className="card-list">
      <div className="card">
        <label className="field">
          <span className="field-label">New facility</span>
          <input
            type="text"
            aria-label="Facility name"
            placeholder="e.g. Goshen Plant"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button button-primary button-block"
          disabled={trimmed.length === 0}
          onClick={() => {
            onAdd(trimmed)
            setNewName('')
          }}
        >
          Add facility
        </button>
      </div>

      {facilities.length === 0 && <p className="muted">No facilities yet.</p>}

      {facilities.map((f) => (
        <FacilityCard
          key={f.id}
          facility={f}
          onRename={onRename}
          onDelete={onDelete}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

/** A single Facility card with inline rename and delete (mobile and tablet). */
function FacilityCard({
  facility,
  onRename,
  onDelete,
  onOpen,
}: {
  facility: MyFacility
  onRename: (facility: MyFacility, name: string) => void
  onDelete: (facility: MyFacility) => void
  onOpen: (facility: MyFacility) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(facility.name)
  const trimmed = name.trim()

  return (
    <div className="card">
      <div className="record-head">
        <div className="facility-summary-heading">
          <span className="card-title">{facility.name}</span>
        </div>
      </div>

      {editing ? (
        <>
          <label className="field">
            <span className="field-label">Facility name</span>
            <input
              type="text"
              aria-label="Facility name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="button button-primary button-sm"
              disabled={trimmed.length === 0}
              onClick={() => {
                onRename(facility, trimmed)
                setEditing(false)
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="button button-secondary button-sm"
              onClick={() => {
                setName(facility.name)
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
            onClick={() => onOpen(facility)}
          >
            Manage
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => setEditing(true)}
          >
            Rename
          </button>
          <button
            type="button"
            className="button button-danger button-sm"
            onClick={() => onDelete(facility)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
