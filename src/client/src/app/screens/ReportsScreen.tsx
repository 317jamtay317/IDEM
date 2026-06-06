import { useCallback, useEffect, useState } from 'react'
import { reports } from '../data'
import { StatusPill } from '../components/StatusPill'
import { TopBar } from '../components/TopBar'
import { openPdfInNewTab } from '../reportBuilder/download'
import {
  reportTemplatesApi as defaultApi,
  type ReportTemplatesApi,
  type SavedReportTemplate,
} from '../reportTemplatesApi'

/** Props for {@link ReportsScreen}. */
export interface ReportsScreenProps {
  /**
   * Whether the signed-in user is a SiteAdmin (I-D13). SiteAdmins author Report
   * Templates, so they alone see the Report Builder entry and the saved-templates
   * list. Defaults to `false` (an Org User).
   */
  isSiteAdmin?: boolean
  /**
   * Opens the Report Builder for the given Report Template id (`'new'` for a fresh
   * template). Wired for SiteAdmins; omitted for Org Users, who cannot author Templates.
   */
  onOpenReportBuilder?: (templateId: string) => void
  /** Bearer access token used to authorize Report Template requests. */
  accessToken?: string | null
  /** Report Template operations. Defaults to the live `fetch` client; injectable for tests. */
  api?: ReportTemplatesApi
}

/** Formats an ISO-8601 UTC timestamp as a short, locale-aware date, e.g. "Jun 4, 2026". */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * IDEM Reports screen: annual and periodic filings. Cards reflow from a single
 * column on mobile to two on tablet and three on desktop. Each card carries a
 * status pill, an optional progress/filed line and a contextual action.
 *
 * A SiteAdmin (I-D13) additionally sees the Report Templates they author: an entry
 * into the Report Builder for a new template, and a list of the saved templates,
 * each of which can be re-opened for editing or rendered to a PDF by the Report
 * Engine (the most direct way to exercise the server-side RDL→PDF pipeline). Org
 * Users see neither.
 */
export function ReportsScreen({
  isSiteAdmin = false,
  onOpenReportBuilder,
  accessToken = null,
  api = defaultApi,
}: ReportsScreenProps) {
  const [templates, setTemplates] = useState<SavedReportTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  // The template whose Delete is awaiting confirmation, or null. Deletion is
  // destructive, so it takes a second click (Confirm) on an inline prompt.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // SiteAdmins load the saved templates; Org Users never reach this endpoint (I-D13).
  const reload = useCallback(() => {
    if (!isSiteAdmin) return
    let cancelled = false
    api
      .list(accessToken)
      .then((data) => {
        if (!cancelled) setTemplates(data)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [isSiteAdmin, accessToken, api])

  useEffect(reload, [reload])

  /** Render a saved template to PDF via the server-side Report Engine and open it. */
  async function handleDownloadPdf(template: SavedReportTemplate) {
    setPdfError(null)
    try {
      const blob = await api.renderPdf(accessToken, template.rdl)
      openPdfInNewTab(blob)
    } catch (e) {
      setPdfError(String(e))
    }
  }

  /** Delete a saved template (after the inline confirm), then refresh the list. */
  async function handleDelete(template: SavedReportTemplate) {
    setError(null)
    try {
      await api.remove(accessToken, template.id)
      setConfirmingId(null)
      reload()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <>
      <TopBar title="IDEM Reports" subtitle="Annual & periodic filings for IDEM" />

      <div className="screen">
        <p className="screen-intro muted">Annual &amp; periodic filings for IDEM</p>

        {isSiteAdmin && onOpenReportBuilder && (
          <section className="card report-builder-entry" aria-label="Report Templates">
            <div className="report-text">
              <span className="card-title">Report Templates</span>
              <span className="muted">
                Design the report templates RecordKeeping authors for IDEM and MDEQ.
              </span>
            </div>
            <button
              type="button"
              className="button button-primary"
              onClick={() => onOpenReportBuilder('new')}
            >
              New Report Template
            </button>
          </section>
        )}

        {isSiteAdmin && (
          <section className="report-templates" aria-label="Saved report templates">
            <h2 className="section-heading">Saved report templates</h2>

            {error && <div className="auth-alert">Error: {error}</div>}
            {pdfError && <div className="auth-alert">Error: {pdfError}</div>}

            {templates === null && !error && (
              <p className="muted">Loading saved templates…</p>
            )}

            {templates !== null && templates.length === 0 && (
              <p className="muted">
                No saved report templates yet. Create one with “New Report Template”.
              </p>
            )}

            {templates !== null && templates.length > 0 && (
              <div className="report-grid">
                {templates.map((template) => (
                  <div key={template.id} className="card report-card">
                    <div className="report-head">
                      <div className="report-text">
                        <span className="card-title">{template.name}</span>
                        <span className="muted report-meta">
                          Updated {formatDate(template.updatedAtUtc)}
                        </span>
                      </div>
                    </div>

                    {confirmingId === template.id ? (
                      <div className="row-actions">
                        <span className="muted">Delete “{template.name}”?</span>
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          aria-label={`Confirm delete ${template.name}`}
                          onClick={() => handleDelete(template)}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="button button-secondary button-sm"
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="row-actions">
                        <button
                          type="button"
                          className="button button-primary button-sm"
                          aria-label={`Edit ${template.name}`}
                          onClick={() => onOpenReportBuilder?.(template.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button-secondary button-sm"
                          aria-label={`Download PDF for ${template.name}`}
                          onClick={() => handleDownloadPdf(template)}
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          aria-label={`Delete ${template.name}`}
                          onClick={() => setConfirmingId(template.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <h2 className="section-heading">Filings</h2>
        <div className="report-grid">
          {reports.map((report) => {
            const primary = report.status === 'due-soon'
            return (
              <div key={report.id} className="card report-card">
                <div className="report-head">
                  <div className="report-text">
                    <span className="card-title">{report.title}</span>
                    <span className="muted">{report.context}</span>
                  </div>
                  <StatusPill status={report.status} />
                </div>

                {report.progress && <span className="muted report-meta">{report.progress}</span>}
                {report.filed && <span className="muted report-meta report-filed">{report.filed}</span>}

                <button
                  type="button"
                  className={`button button-block ${primary ? 'button-primary' : 'button-secondary'}`}
                >
                  {report.action}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
