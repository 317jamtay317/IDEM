/**
 * Thin client for the Org User self-service Facility endpoints
 * (`/me/org/facilities`). Every call is bearer-authenticated with the SPA access
 * token; the server scopes the operation to the caller's own Org via the `org_id`
 * claim (I-D03), so no Org id is ever sent from the client. Failures throw with the
 * HTTP status so callers can surface a message.
 *
 * Mirrors the server contract:
 *  - GET    /me/org/facilities                              list the caller's Org's Facilities
 *  - POST   /me/org/facilities                              add a Facility (name only)
 *  - PUT    /me/org/facilities/{id}                         rename a Facility
 *  - DELETE /me/org/facilities/{id}                         remove a Facility
 *  - GET    /me/org/facilities/{id}/permits                 list a Facility's Permits
 *  - POST   /me/org/facilities/{id}/permits                 add a Permit
 *  - DELETE /me/org/facilities/{id}/permits/{permitId}      remove a Permit
 *  - GET    /me/org/facilities/{id}/limits                  list a Facility's Monthly Limits
 *  - POST   /me/org/facilities/{id}/limits                  add a Monthly Limit
 *  - PUT    /me/org/facilities/{id}/limits/{emissionType}   change a Monthly Limit's value
 *  - DELETE /me/org/facilities/{id}/limits/{emissionType}   remove a Monthly Limit
 */

/** A Facility belonging to the signed-in user's Org, as returned by the API. */
export interface MyFacility {
  /** Stable identifier (GUID). */
  id: string
  /** Facility display name, e.g. "Goshen Plant". */
  name: string
}

/** A Permit held by a Facility — a regulatory authorization to operate. */
export interface Permit {
  /** Stable identifier (GUID). */
  id: string
  /** Expiration date, ISO `yyyy-MM-dd`. */
  expirationDate: string
  /** The permit number / identifier. */
  value: string
}

/** The pollutants a Monthly Limit may constrain (the v1 Emission Type set). */
export type EmissionType = 'VOC' | 'HCl' | 'SO2' | 'NOx' | 'CO2'

/** The Emission Types offered when adding a Monthly Limit, in display order. */
export const EMISSION_TYPES: readonly EmissionType[] = ['VOC', 'HCl', 'SO2', 'NOx', 'CO2']

/** A Monthly Limit on a Facility — a tons/month cap on one Emission Type. */
export interface MonthlyLimit {
  /** The pollutant the limit constrains. */
  emissionType: EmissionType
  /** The cap, in tons per calendar month. */
  value: number
}

/** Bundle of CRUD operations the Facilities screens depend on. */
export interface MyFacilitiesApi {
  /** Loads the caller's Org's Facilities. */
  list: (accessToken: string | null) => Promise<MyFacility[]>
  /** Adds a Facility to the caller's Org with the given name. */
  add: (accessToken: string | null, name: string) => Promise<MyFacility>
  /** Renames one of the caller's Org's Facilities. */
  rename: (accessToken: string | null, id: string, name: string) => Promise<MyFacility>
  /** Removes one of the caller's Org's Facilities. */
  remove: (accessToken: string | null, id: string) => Promise<void>

  /** Lists a Facility's Permits. */
  listPermits: (accessToken: string | null, facilityId: string) => Promise<Permit[]>
  /** Adds a Permit to a Facility. */
  addPermit: (
    accessToken: string | null,
    facilityId: string,
    permit: { expirationDate: string; value: string },
  ) => Promise<Permit>
  /** Removes a Permit from a Facility. */
  removePermit: (accessToken: string | null, facilityId: string, permitId: string) => Promise<void>

  /** Lists a Facility's Monthly Limits. */
  listLimits: (accessToken: string | null, facilityId: string) => Promise<MonthlyLimit[]>
  /** Adds a Monthly Limit to a Facility. */
  addLimit: (
    accessToken: string | null,
    facilityId: string,
    limit: { emissionType: EmissionType; value: number },
  ) => Promise<MonthlyLimit>
  /** Changes the tons value of a Facility's Monthly Limit, addressed by Emission Type. */
  updateLimit: (
    accessToken: string | null,
    facilityId: string,
    emissionType: EmissionType,
    value: number,
  ) => Promise<MonthlyLimit>
  /** Removes a Monthly Limit from a Facility, addressed by Emission Type. */
  removeLimit: (
    accessToken: string | null,
    facilityId: string,
    emissionType: EmissionType,
  ) => Promise<void>
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

  async listPermits(accessToken, facilityId) {
    const res = await fetch(`/me/org/facilities/${facilityId}/permits`, {
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Permits load failed (${res.status})`)
    return (await res.json()) as Permit[]
  },

  async addPermit(accessToken, facilityId, permit) {
    const res = await fetch(`/me/org/facilities/${facilityId}/permits`, {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(permit),
    })
    if (!res.ok) throw new Error(`Add permit failed (${res.status})`)
    return (await res.json()) as Permit
  },

  async removePermit(accessToken, facilityId, permitId) {
    const res = await fetch(`/me/org/facilities/${facilityId}/permits/${permitId}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Remove permit failed (${res.status})`)
  },

  async listLimits(accessToken, facilityId) {
    const res = await fetch(`/me/org/facilities/${facilityId}/limits`, {
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Limits load failed (${res.status})`)
    return (await res.json()) as MonthlyLimit[]
  },

  async addLimit(accessToken, facilityId, limit) {
    const res = await fetch(`/me/org/facilities/${facilityId}/limits`, {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(limit),
    })
    if (!res.ok) throw new Error(`Add limit failed (${res.status})`)
    return (await res.json()) as MonthlyLimit
  },

  async updateLimit(accessToken, facilityId, emissionType, value) {
    const res = await fetch(`/me/org/facilities/${facilityId}/limits/${emissionType}`, {
      method: 'PUT',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ value }),
    })
    if (!res.ok) throw new Error(`Update limit failed (${res.status})`)
    return (await res.json()) as MonthlyLimit
  },

  async removeLimit(accessToken, facilityId, emissionType) {
    const res = await fetch(`/me/org/facilities/${facilityId}/limits/${emissionType}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Remove limit failed (${res.status})`)
  },
}
