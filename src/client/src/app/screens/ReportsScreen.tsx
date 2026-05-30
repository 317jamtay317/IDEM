import { reports } from '../data'
import { StatusPill } from '../components/StatusPill'
import { TopBar } from '../components/TopBar'

/**
 * IDEM Reports screen: annual and periodic filings. Cards reflow from a single
 * column on mobile to two on tablet and three on desktop. Each card carries a
 * status pill, an optional progress/filed line and a contextual action.
 */
export function ReportsScreen() {
  return (
    <>
      <TopBar title="IDEM Reports" subtitle="Annual & periodic filings for IDEM" />

      <div className="screen">
        <p className="screen-intro muted">Annual &amp; periodic filings for IDEM</p>

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
