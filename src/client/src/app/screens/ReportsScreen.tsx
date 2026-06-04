import { reports } from '../data'
import { StatusPill } from '../components/StatusPill'
import { TopBar } from '../components/TopBar'

/** Props for {@link ReportsScreen}. */
export interface ReportsScreenProps {
  /**
   * Whether the signed-in user is a SiteAdmin (I-D13). SiteAdmins author Report
   * Templates, so they alone are offered the Report Builder entry. Defaults to
   * `false` (an Org User).
   */
  isSiteAdmin?: boolean
  /**
   * Opens the Report Builder for the given Report Template id. Wired for
   * SiteAdmins; omitted for Org Users, who cannot author Templates.
   */
  onOpenReportBuilder?: (templateId: string) => void
}

/**
 * IDEM Reports screen: annual and periodic filings. Cards reflow from a single
 * column on mobile to two on tablet and three on desktop. Each card carries a
 * status pill, an optional progress/filed line and a contextual action.
 *
 * A SiteAdmin (I-D13) additionally sees a Report Builder entry for authoring the
 * Report Templates RecordKeeping ships; Org Users do not.
 */
export function ReportsScreen({ isSiteAdmin = false, onOpenReportBuilder }: ReportsScreenProps) {
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
