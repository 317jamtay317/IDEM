import type { OrgSummary } from './data'

/**
 * Thin client for the Org CRUD endpoints (`/orgs`). Every call is bearer-
 * authenticated with the SPA access token, mirroring the `/api/me` pattern in
 * App.tsx. Failures throw with the HTTP status so callers can surface a message.
 *
 * Mirrors the server contract:
 *  - POST   /orgs            create (name only)
 *  - PUT    /orgs/{id}       update SSO config; name must match (rename is 409)
 *  - DELETE /orgs/{id}       permanent delete
 */

/** Bundle of CRUD operations the Organizations screen depends on. */
export interface OrgsApi {
  /** Loads every Org. */
  list: (accessToken: string | null) => Promise<OrgSummary[]>
  /** Creates a new Org with the given name. */
  create: (accessToken: string | null, name: string) => Promise<OrgSummary>
  /**
   * Updates an Org's Entra ID SSO configuration (I-D12). `name` must equal the
   * Org's current name — the server rejects renames with 409. Pass `tenantId`
   * to federate SSO, or `null` to disable it.
   */
  update: (
    accessToken: string | null,
    id: string,
    name: string,
    tenantId: string | null,
  ) => Promise<OrgSummary>
  /** Permanently deletes an Org. */
  remove: (accessToken: string | null, id: string) => Promise<void>
}

function authHeaders(accessToken: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

/** Default {@link OrgsApi} backed by `fetch` against the live endpoints. */
export const orgsApi: OrgsApi = {
  async list(accessToken) {
    const res = await fetch('/orgs', { headers: authHeaders(accessToken) })
    if (!res.ok) throw new Error(`/orgs returned ${res.status}`)
    return (await res.json()) as OrgSummary[]
  },

  async create(accessToken, name) {
    const res = await fetch('/orgs', {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`Create failed (${res.status})`)
    return (await res.json()) as OrgSummary
  },

  async update(accessToken, id, name, tenantId) {
    const res = await fetch(`/orgs/${id}`, {
      method: 'PUT',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ name, tenantId }),
    })
    if (!res.ok) throw new Error(`Update failed (${res.status})`)
    return (await res.json()) as OrgSummary
  },

  async remove(accessToken, id) {
    const res = await fetch(`/orgs/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Delete failed (${res.status})`)
  },
}
