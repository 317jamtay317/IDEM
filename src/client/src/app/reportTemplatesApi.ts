/**
 * Thin client for the SiteAdmin-only Report Template endpoints (`/api/report-templates`).
 * Bearer-authenticated with the SPA access token; the server gates the whole group to SiteAdmins
 * (I-D13). Failures throw with the HTTP status so callers can surface a message.
 *
 * Mirrors the server contract:
 *  - GET    /api/report-templates            list saved templates (most recently updated first)
 *  - GET    /api/report-templates/{id}       load one template, including its RDL, for editing
 *  - POST   /api/report-templates            save a new template
 *  - PUT    /api/report-templates/{id}       overwrite an existing template
 *  - POST   /api/report-templates/preview    render a template's RDL to a PDF (the Report Engine)
 */

/** A saved Report Template as returned by the API. */
export interface SavedReportTemplate {
  /** Stable identifier (GUID). */
  id: string
  /** Display name shown in the saved-templates list. */
  name: string
  /** The template definition as RDL/RDLC XML (round-trips through the builder's `parseRdl`/`toRdl`). */
  rdl: string
  /** When the template was first created (ISO-8601 UTC). */
  createdAtUtc: string
  /** When the template was last saved (ISO-8601 UTC). */
  updatedAtUtc: string
}

/** Payload for creating or updating a Report Template. */
export interface SaveReportTemplateInput {
  /** The display name. */
  name: string
  /** The template definition as RDL/RDLC XML. */
  rdl: string
}

/** Operations the Reports screen and Report Builder depend on. */
export interface ReportTemplatesApi {
  /** Lists the saved Report Templates, most recently updated first. */
  list: (accessToken: string | null) => Promise<SavedReportTemplate[]>
  /** Loads a single Report Template (including its RDL) for editing. */
  get: (accessToken: string | null, id: string) => Promise<SavedReportTemplate>
  /** Saves a new Report Template. */
  create: (accessToken: string | null, input: SaveReportTemplateInput) => Promise<SavedReportTemplate>
  /** Overwrites an existing Report Template with the builder's latest definition. */
  update: (
    accessToken: string | null,
    id: string,
    input: SaveReportTemplateInput,
  ) => Promise<SavedReportTemplate>
  /** Deletes a saved Report Template by id. */
  remove: (accessToken: string | null, id: string) => Promise<void>
  /** Renders a template's RDL to a PDF via the server-side Report Engine, returning the PDF bytes. */
  renderPdf: (accessToken: string | null, rdl: string) => Promise<Blob>
}

const BASE = '/api/report-templates'

function authHeaders(accessToken: string | null, json = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

/** Default {@link ReportTemplatesApi} backed by `fetch` against the live endpoints. */
export const reportTemplatesApi: ReportTemplatesApi = {
  async list(accessToken) {
    const res = await fetch(BASE, { headers: authHeaders(accessToken) })
    if (!res.ok) throw new Error(`${BASE} returned ${res.status}`)
    return (await res.json()) as SavedReportTemplate[]
  },

  async get(accessToken, id) {
    const res = await fetch(`${BASE}/${id}`, { headers: authHeaders(accessToken) })
    if (!res.ok) throw new Error(`${BASE}/${id} returned ${res.status}`)
    return (await res.json()) as SavedReportTemplate
  },

  async create(accessToken, input) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Save failed (${res.status})`)
    return (await res.json()) as SavedReportTemplate
  },

  async update(accessToken, id, input) {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Save failed (${res.status})`)
    return (await res.json()) as SavedReportTemplate
  },

  async remove(accessToken, id) {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    })
    if (!res.ok) throw new Error(`Delete failed (${res.status})`)
  },

  async renderPdf(accessToken, rdl) {
    const res = await fetch(`${BASE}/preview`, {
      method: 'POST',
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ rdl }),
    })
    if (!res.ok) throw new Error(`Preview failed (${res.status})`)
    return await res.blob()
  },
}
