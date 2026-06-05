/**
 * Thin client for the Production Field catalog endpoints (`/production-fields`).
 * Every call is bearer-authenticated with the SPA access token, mirroring
 * {@link ../orgsApi}. Failures throw with the HTTP status so callers can surface a message.
 *
 * Mirrors the server contract:
 *  - GET    /production-fields[?includeRetired=true]   list (active only by default)
 *  - POST   /production-fields                         create
 *  - PUT    /production-fields/{id}                    update editable attributes (key is immutable)
 *  - POST   /production-fields/{id}/retire             retire (hide from new Records)
 *  - POST   /production-fields/{id}/reactivate         reactivate
 */

/** The kinds of value a Production Field can capture; mirrors the server's `ProductionFieldDataType`. */
export const DATA_TYPES = ['Decimal', 'Integer', 'Boolean', 'Date'] as const

/** A Production Field's data type. */
export type ProductionFieldDataType = (typeof DATA_TYPES)[number]

/** A Production Field as returned by the catalog API. */
export interface ProductionField {
  /** Stable identifier (GUID). */
  id: string
  /** Immutable machine key, e.g. "HotMix" (I-D21). */
  propertyName: string
  /** Human-facing label, e.g. "Hot Mix" (unique among active fields, I-D22). */
  friendlyName: string
  /** Optional help text, or null. */
  description: string | null
  /** The kind of value the field captures. */
  dataType: ProductionFieldDataType
  /** Optional picker grouping, or null. */
  category: string | null
  /** Whether the field appears in summaries/Reports by default. */
  isSummary: boolean
  /** Sort position in the picker. */
  displayOrder: number
  /** Whether the field is offered for new Records. */
  isActive: boolean
}

/** Fields accepted when creating a Production Field. */
export interface CreateProductionFieldInput {
  propertyName: string
  friendlyName: string
  dataType: ProductionFieldDataType
  description: string | null
  category: string | null
  isSummary: boolean
  displayOrder: number
}

/** Editable fields accepted when updating a Production Field (PropertyName is immutable). */
export interface UpdateProductionFieldInput {
  friendlyName: string
  dataType: ProductionFieldDataType
  description: string | null
  category: string | null
  isSummary: boolean
  displayOrder: number
}

/** Bundle of catalog operations the Production Fields screen depends on. */
export interface ProductionFieldsApi {
  /** Lists Production Fields; active only unless {@link includeRetired} is true. */
  list: (accessToken: string | null, includeRetired?: boolean) => Promise<ProductionField[]>
  /** Adds a Production Field to the catalog. */
  create: (accessToken: string | null, input: CreateProductionFieldInput) => Promise<ProductionField>
  /** Updates a Production Field's editable attributes. */
  update: (
    accessToken: string | null,
    id: string,
    input: UpdateProductionFieldInput,
  ) => Promise<ProductionField>
  /** Retires a Production Field so it is no longer offered for new Records. */
  retire: (accessToken: string | null, id: string) => Promise<ProductionField>
  /** Reactivates a retired Production Field. */
  reactivate: (accessToken: string | null, id: string) => Promise<ProductionField>
}

function authHeaders(accessToken: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

/** Default {@link ProductionFieldsApi} backed by `fetch` against the live endpoints. */
export const productionFieldsApi: ProductionFieldsApi = {
  async list(accessToken, includeRetired = false) {
    const url = includeRetired ? '/production-fields?includeRetired=true' : '/production-fields'
    const res = await fetch(url, { headers: authHeaders(accessToken) })
    if (!res.ok) throw new Error(`/production-fields returned ${res.status}`)
    return (await res.json()) as ProductionField[]
  },

  async create(accessToken, input) {
    const res = await fetch('/production-fields', {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Create failed (${res.status})`)
    return (await res.json()) as ProductionField
  },

  async update(accessToken, id, input) {
    const res = await fetch(`/production-fields/${id}`, {
      method: 'PUT',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Update failed (${res.status})`)
    return (await res.json()) as ProductionField
  },

  async retire(accessToken, id) {
    const res = await fetch(`/production-fields/${id}/retire`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Retire failed (${res.status})`)
    return (await res.json()) as ProductionField
  },

  async reactivate(accessToken, id) {
    const res = await fetch(`/production-fields/${id}/reactivate`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Reactivate failed (${res.status})`)
    return (await res.json()) as ProductionField
  },
}
