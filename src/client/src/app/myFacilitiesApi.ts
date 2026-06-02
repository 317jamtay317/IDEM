/**
 * Thin client for the Org User self-service Facility endpoints
 * (`/me/org/facilities`). Every call is bearer-authenticated with the SPA access
 * token; the server scopes the operation to the caller's own Org via the `org_id`
 * claim (I-D03), so no Org id is ever sent from the client. Failures throw with the
 * HTTP status so callers can surface a message.
 *
 * Mirrors the server contract:
 *  - GET    /me/org/facilities             list the caller's Org's Facilities
 *  - POST   /me/org/facilities             add a Facility (name only)
 *  - PUT    /me/org/facilities/{id}        rename a Facility
 *  - DELETE /me/org/facilities/{id}        remove a Facility
 */

/** A Facility belonging to the signed-in user's Org, as returned by the API. */
export interface MyFacility {
  /** Stable identifier (GUID). */
  id: string
  /** Facility display name, e.g. "Goshen Plant". */
  name: string
}

/** Bundle of CRUD operations the Facilities screen depends on. */
export interface MyFacilitiesApi {
  /** Loads the caller's Org's Facilities. */
  list: (accessToken: string | null) => Promise<MyFacility[]>
  /** Adds a Facility to the caller's Org with the given name. */
  add: (accessToken: string | null, name: string) => Promise<MyFacility>
  /** Renames one of the caller's Org's Facilities. */
  rename: (accessToken: string | null, id: string, name: string) => Promise<MyFacility>
  /** Removes one of the caller's Org's Facilities. */
  remove: (accessToken: string | null, id: string) => Promise<void>
}

function authHeaders(accessToken: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

/** Default {@link MyFacilitiesApi} backed by `fetch` against the live endpoints. */
export const myFacilitiesApi: MyFacilitiesApi = {
  async list(accessToken) {
    const res = await fetch('/me/org/facilities', { headers: authHeaders(accessToken) })
    if (!res.ok) throw new Error(`/me/org/facilities returned ${res.status}`)
    return (await res.json()) as MyFacility[]
  },

  async add(accessToken, name) {
    const res = await fetch('/me/org/facilities', {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`Add failed (${res.status})`)
    return (await res.json()) as MyFacility
  },

  async rename(accessToken, id, name) {
    const res = await fetch(`/me/org/facilities/${id}`, {
      method: 'PUT',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`Rename failed (${res.status})`)
    return (await res.json()) as MyFacility
  },

  async remove(accessToken, id) {
    const res = await fetch(`/me/org/facilities/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Remove failed (${res.status})`)
  },
}
