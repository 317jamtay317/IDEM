/**
 * Thin client for the Org User self-service Production Field Limit endpoints
 * (`/me/org/production-field-limits`). Bearer-authenticated with the SPA access token; the server scopes
 * every operation to the caller's own Org via the `org_id` claim (I-D03), so no Org id is ever sent from
 * the client. Failures throw with the HTTP status so callers can surface a message.
 *
 * Mirrors the server contract:
 *  - GET /me/org/production-field-limits                  list the caller's Org's limits
 *  - PUT /me/org/production-field-limits/{propertyName}   set (create or update) one field's limit
 */

/** How a limit's bounds are expressed; mirrors the server `LimitUnit`. (🟡 unit set pending owner.) */
export const LIMIT_UNITS = ['Percentage', 'Tons'] as const

/** A Production Field Limit's unit. */
export type LimitUnit = (typeof LIMIT_UNITS)[number]

/** A Production Field Limit as returned by the API. */
export interface ProductionFieldLimit {
  /** The Production Field's immutable key the limit applies to (I-D21). */
  propertyName: string
  /** The lowest acceptable recorded value. */
  lowLimit: number
  /** The highest acceptable recorded value (≥ {@link lowLimit}, I-D25). */
  highLimit: number
  /** Whether the bounds are a percentage or tons. */
  unit: LimitUnit
}

/** The bounds + unit sent when setting a field's limit (the field is addressed in the route). */
export interface SetProductionFieldLimitInput {
  lowLimit: number
  highLimit: number
  unit: LimitUnit
}

/** Operations the Field Limits screen depends on. */
export interface ProductionFieldLimitsApi {
  /** Lists the caller's Org's limits. Org scope is enforced server-side from the token (I-D03). */
  list: (accessToken: string | null) => Promise<ProductionFieldLimit[]>
  /** Sets (creates or updates) the caller's Org limit for one Production Field. */
  set: (
    accessToken: string | null,
    propertyName: string,
    input: SetProductionFieldLimitInput,
  ) => Promise<ProductionFieldLimit>
}

function authHeaders(accessToken: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

const BASE = '/me/org/production-field-limits'

/** Default {@link ProductionFieldLimitsApi} backed by `fetch` against the live endpoints. */
export const productionFieldLimitsApi: ProductionFieldLimitsApi = {
  async list(accessToken) {
    const res = await fetch(BASE, { headers: authHeaders(accessToken) })
    if (!res.ok) throw new Error(`${BASE} returned ${res.status}`)
    return (await res.json()) as ProductionFieldLimit[]
  },

  async set(accessToken, propertyName, input) {
    const res = await fetch(`${BASE}/${encodeURIComponent(propertyName)}`, {
      method: 'PUT',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Save failed (${res.status})`)
    return (await res.json()) as ProductionFieldLimit
  },
}
