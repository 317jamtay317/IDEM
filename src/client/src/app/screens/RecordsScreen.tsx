import { useState } from 'react'
import {
  facilitySummaries,
  productionByFacility,
  type FacilitySummary,
  type ProductionDay,
} from '../data'
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

/** Format a tonnage with thousands separators, pinned to en-US for determinism. */
function formatTons(tons: number): string {
  return tons.toLocaleString('en-US')
}

/** Format the Plant Ran value, in hours, e.g. "8.5 h"; "0 h" on an idle day. */
function formatHours(hours: number): string {
  return `${hours} h`
}

/**
 * Columns for the desktop Records grid — a per-Facility compliance rollup. The
 * Facility name is a button that drills into that plant's production; the other
 * cells match the design's emphasis, with Monthly due coloured by urgency and
 * Status rendered as a {@link StatusPill}.
 */
function facilityColumns(
  onSelect: (facility: FacilitySummary) => void,
): GridColumn<FacilitySummary>[] {
  return [
    {
      key: 'name',
      header: 'Facility',
      render: (f) => (
        <button type="button" className="facility-link" onClick={() => onSelect(f)}>
          {f.name}
        </button>
      ),
    },
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
}

/**
 * Columns for the production drill-down grid, in the order requested: Date,
 * Hot Mix, Cold Mix, Plant Ran (hours), Steel Slag, Blast Furnace. All numeric
 * columns are right-aligned; idle (0-hour) Plant Ran values read muted.
 */
const productionColumns: GridColumn<ProductionDay>[] = [
  { key: 'date', header: 'Date', render: (d) => <span className="cell-strong">{d.date}</span> },
  { key: 'hotMix', header: 'Hot Mix', align: 'right', render: (d) => formatTons(d.hotMix) },
  { key: 'coldMix', header: 'Cold Mix', align: 'right', render: (d) => formatTons(d.coldMix) },
  {
    key: 'plantRanHours',
    header: 'Plant Ran',
    align: 'right',
    render: (d) => (
      <span className={d.plantRanHours > 0 ? undefined : 'muted'}>{formatHours(d.plantRanHours)}</span>
    ),
  },
  { key: 'steelSlag', header: 'Steel Slag', align: 'right', render: (d) => formatTons(d.steelSlag) },
  {
    key: 'blastFurnace',
    header: 'Blast Furnace',
    align: 'right',
    render: (d) => formatTons(d.blastFurnace),
  },
]

/**
 * Records screen. Lists each active Facility's compliance rollup; selecting a
 * Facility drills into a paged grid of that plant's last ten days of production.
 * Desktop renders the list as a data table (via {@link GridControl}); mobile and
 * tablet render stacked Facility cards. The drill-down is a grid at every tier.
 */
export function RecordsScreen() {
  const { isDesktop } = useBreakpoint()
  const [selected, setSelected] = useState<FacilitySummary | null>(null)

  if (selected) {
    return <ProductionDrillDown facility={selected} onBack={() => setSelected(null)} />
  }

  return (
    <>
      <TopBar title="Records" subtitle={`Active facilities · ${facilitySummaries.length} plants`} />

      <div className="screen">
        <span className="group-label">Active facilities</span>

        {isDesktop ? (
          <div className="card table-card">
            <GridControl
              columns={facilityColumns((f) => setSelected(f))}
              rows={facilitySummaries}
              rowKey={(facility) => facility.id}
              ariaLabel="Records"
              emptyText="No active facilities."
            />
          </div>
        ) : (
          <div className="card-list">
            {facilitySummaries.map((facility) => (
              <FacilityCard key={facility.id} facility={facility} onSelect={(f) => setSelected(f)} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/** The last-ten-days production grid for one Facility, paged five rows at a time. */
function ProductionDrillDown({
  facility,
  onBack,
}: {
  facility: FacilitySummary
  onBack: () => void
}) {
  const days = productionByFacility[facility.id] ?? []
  return (
    <>
      <TopBar title={facility.name} subtitle={`Production · last 10 days · ${facility.region}`} />

      <div className="screen">
        <button type="button" className="button button-secondary records-back" onClick={onBack}>
          ← Back to facilities
        </button>

        <div className="card table-card">
          <GridControl
            columns={productionColumns}
            rows={days}
            rowKey={(day) => day.id}
            ariaLabel={`${facility.name} production`}
            paging={{ mode: 'client', pageSize: 5 }}
            emptyText="No production in the last 10 days."
          />
        </div>
      </div>
    </>
  )
}

/** A single Facility compliance rollup rendered as a tappable card (mobile and tablet). */
function FacilityCard({
  facility,
  onSelect,
}: {
  facility: FacilitySummary
  onSelect: (facility: FacilitySummary) => void
}) {
  return (
    <button
      type="button"
      className="card facility-summary-card"
      onClick={() => onSelect(facility)}
    >
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
    </button>
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
