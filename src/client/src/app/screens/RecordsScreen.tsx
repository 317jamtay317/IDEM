import { facilitySummaries, type FacilitySummary } from '../data'
import { GridControl, type GridColumn } from '../components/GridControl'
import { StatusPill } from '../components/StatusPill'
import { TopBar } from '../components/TopBar'
import { useBreakpoint } from '../useBreakpoint'

/**
 * Text-colour modifier for a Facility's monthly-due date, by urgency: red when
 * overdue, amber when due soon, and the default colour when on track.
 */
function dueToneClass(status: FacilitySummary['status']): string | undefined {
  if (status === 'overdue') return 'text-danger'
  if (status === 'due-soon') return 'text-warning'
  return undefined
}

/**
 * Columns for the desktop Records grid — a per-Facility compliance rollup. Cells
 * are templated to match the design's emphasis: the Facility name and Monthly
 * due read strong (Monthly due additionally coloured by urgency), the other
 * dates muted, and Status as a {@link StatusPill}.
 */
const facilityColumns: GridColumn<FacilitySummary>[] = [
  { key: 'name', header: 'Facility', render: (f) => <span className="cell-strong">{f.name}</span> },
  { key: 'lastRan', header: 'Last ran', render: (f) => <span className="muted">{f.lastRan}</span> },
  {
    key: 'lastRecord',
    header: 'Last record',
    render: (f) => <span className="muted">{f.lastRecord}</span>,
  },
  {
    key: 'monthlyDue',
    header: 'Monthly due',
    render: (f) => (
      <span className={['cell-strong', dueToneClass(f.status)].filter(Boolean).join(' ')}>
        {f.monthlyDue}
      </span>
    ),
  },
  {
    key: 'quarterlyDue',
    header: 'Quarterly due',
    render: (f) => <span className="muted">{f.quarterlyDue}</span>,
  },
  { key: 'status', header: 'Status', render: (f) => <StatusPill status={f.status} /> },
]

/**
 * Records screen. Shows each active Facility's compliance rollup — last run,
 * last record, and the next monthly/quarterly filing dates with an overall
 * status. Desktop renders a data table (via {@link GridControl}); mobile and
 * tablet render stacked Facility cards.
 */
export function RecordsScreen() {
  const { isDesktop } = useBreakpoint()

  return (
    <>
      <TopBar
        title="Records"
        subtitle={`Active facilities · ${facilitySummaries.length} plants`}
      />

      <div className="screen">
        <span className="group-label">Active facilities</span>

        {isDesktop ? (
          <div className="card table-card">
            <GridControl
              columns={facilityColumns}
              rows={facilitySummaries}
              rowKey={(facility) => facility.id}
              ariaLabel="Records"
              emptyText="No active facilities."
            />
          </div>
        ) : (
          <div className="card-list">
            {facilitySummaries.map((facility) => (
              <FacilityCard key={facility.id} facility={facility} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/** A single Facility compliance rollup rendered as a card (mobile and tablet). */
function FacilityCard({ facility }: { facility: FacilitySummary }) {
  return (
    <div className="card facility-summary-card">
      <div className="record-head">
        <div className="facility-summary-heading">
          <span className="card-title">{facility.name}</span>
          <span className="muted">{facility.region}</span>
        </div>
        <StatusPill status={facility.status} />
      </div>

      <div className="facility-summary-fields">
        <SummaryField label="Last ran" value={facility.lastRan} />
        <SummaryField label="Last record" value={facility.lastRecord} />
        <SummaryField
          label="Monthly due"
          value={facility.monthlyDue}
          toneClass={dueToneClass(facility.status)}
        />
        <SummaryField label="Quarterly due" value={facility.quarterlyDue} />
      </div>
    </div>
  )
}

/** A labelled value inside a {@link FacilityCard}, e.g. "LAST RAN / May 29". */
function SummaryField({
  label,
  value,
  toneClass,
}: {
  label: string
  value: string
  toneClass?: string
}) {
  return (
    <div className="facility-summary-field">
      <span className="overline">{label}</span>
      <span className={['summary-field-value', toneClass].filter(Boolean).join(' ')}>{value}</span>
    </div>
  )
}
