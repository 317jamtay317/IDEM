/**
 * Thin client for the Org User self-service Record endpoint (`/me/org/records`).
 * Bearer-authenticated with the SPA access token; the server scopes the operation to the caller's
 * own Org via the `org_id` claim (I-D03), so no Org id is ever sent from the client. Failures throw
 * with the HTTP status so callers can surface a message.
 *
 * Mirrors the server contract:
 *  - POST /me/org/records   log a Record for one of the caller's Org's Facilities
 */

/** A single field value submitted when logging a Record (exactly one typed value per field). */
export interface RecordValueInput {
  /** The Production Field's immutable key, e.g. "HotMix" (I-D21). */
  propertyName: string
  /** Value when the field's DataType is Decimal or Integer. */
  numericValue?: number | null
  /** Value when the field's DataType is Boolean. */
  booleanValue?: boolean | null
  /** Value when the field's DataType is Date, as `yyyy-MM-dd`. */
  dateValue?: string | null
}

/** Payload for logging a Record for a Facility on a date. */
export interface LogRecordInput {
  /** The Facility the Record is for (must belong to the caller's Org). */
  facilityId: string
  /** The calendar date the Record covers, as `yyyy-MM-dd`. */
  date: string
  /** The field values entered; may be empty. */
  values: RecordValueInput[]
}

/** A single recorded value as returned by the API. */
export interface RecordValueResult {
  propertyName: string
  numericValue: number | null
  booleanValue: boolean | null
  dateValue: string | null
}

/** A Record as returned by the API after logging. */
export interface LoggedRecord {
  /** Stable identifier (GUID). */
  id: string
  /** The Facility the Record was logged for. */
  facilityId: string
  /** The calendar date the Record covers, as `yyyy-MM-dd`. */
  date: string
  /** The recorded field values. */
  values: RecordValueResult[]
}

/** Operations the Log a Record screen depends on. */
export interface RecordsApi {
  /** Logs a Record for one of the caller's Org's Facilities. */
  create: (accessToken: string | null, input: LogRecordInput) => Promise<LoggedRecord>
}

function authHeaders(accessToken: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

/** Default {@link RecordsApi} backed by `fetch` against the live endpoint. */
export const recordsApi: RecordsApi = {
  async create(accessToken, input) {
    const res = await fetch('/me/org/records', {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Save failed (${res.status})`)
    return (await res.json()) as LoggedRecord
  },
}
