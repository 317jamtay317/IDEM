/**
 * In-memory sample data for the UI prototype.
 *
 * Everything here is fake and exists only to drive the screens visually while
 * the real API endpoints are built. Names follow the project ubiquitous
 * language (Org, Facility, Record, Report, Regulator, IDEM, Rieth-Riley).
 */

/** A regulatory body a Facility reports to. */
export type Regulator = 'IDEM' | 'MDEQ'

/** Lifecycle/compliance status shared by Records, Reports and Facilities, rendered as a pill. */
export type Status = 'submitted' | 'draft' | 'due-soon' | 'overdue' | 'on-track'

/** An Asphalt Plant (Facility) belonging to the current Org. */
export interface Facility {
  /** Stable identifier. */
  id: string
  /** Display name, e.g. "Goshen Asphalt Plant". */
  name: string
  /** US state the Facility operates in. */
  state: string
  /** Regulator this Facility files with. */
  regulator: Regulator
}

/** A compliance item on the dashboard that needs the user's attention. */
export interface AttentionItem {
  /** Stable identifier. */
  id: string
  /** Short title of the obligation, e.g. "Daily opacity reading". */
  title: string
  /** Context line, e.g. "Goshen · today". */
  context: string
  /** Whether the item is approaching or past its deadline. */
  status: Extract<Status, 'due-soon' | 'overdue'>
}

/**
 * A per-Facility compliance rollup shown on the Records screen — one row in the
 * desktop table, one card on mobile/tablet.
 */
export interface FacilitySummary {
  /** Stable identifier. */
  id: string
  /** Facility display name, e.g. "Goshen Asphalt Plant". */
  name: string
  /** Region and regulator line, e.g. "Indiana · IDEM". */
  region: string
  /** Date the most recent compliance run completed, e.g. "May 29". */
  lastRan: string
  /** Date of the most recent Record entered, e.g. "May 29". */
  lastRecord: string
  /** Next monthly filing due date, e.g. "Jun 15, 2026". Emphasised by {@link FacilitySummary.status}. */
  monthlyDue: string
  /** Next quarterly filing due date, e.g. "Jul 31, 2026". */
  quarterlyDue: string
  /** Overall compliance state, rendered as a pill and used to colour {@link FacilitySummary.monthlyDue}. */
  status: Extract<Status, 'on-track' | 'due-soon' | 'overdue'>
}

/**
 * One day's production tonnage for a Facility, shown as a row in the Records
 * drill-down grid. Tonnage Fields are zero on days the plant did not run.
 */
export interface ProductionDay {
  /** Stable identifier, e.g. "goshen-d0". */
  id: string
  /** Short date label for the day, e.g. "May 31". */
  date: string
  /** Hot Mix tons produced. */
  hotMix: number
  /** Cold Mix tons produced. */
  coldMix: number
  /** Hours the plant ran that day; 0 when it did not run. */
  plantRanHours: number
  /** Steel Slag aggregate tons. */
  steelSlag: number
  /** Blast Furnace slag aggregate tons. */
  blastFurnace: number
}

/** A periodic filing shown on the IDEM Reports screen. */
export interface ReportItem {
  /** Stable identifier. */
  id: string
  /** Report title, e.g. "Annual Emissions Inventory". */
  title: string
  /** Period plus regulator, e.g. "Calendar year 2025 · IDEM". */
  context: string
  /** Current status of the Report. */
  status: Status
  /** Optional readiness line shown at every breakpoint, e.g. "18 of 30 readings entered". */
  progress?: string
  /** Optional filed/due line shown on tablet and desktop, e.g. "Filed Apr 4, 2026". */
  filed?: string
  /** Label for the primary action button on the card. */
  action: string
}

/** A configurable production field on the Log a Record screen. */
export interface ProductionEntry {
  /** Stable identifier. */
  id: string
  /** Selected field name, e.g. "Hot Mix". */
  field: string
  /** Recorded tonnage for the day. */
  tons: number
  /** Permitted daily limit for this field at the Facility. */
  limit: number
}

/** A condensed Record shown in the dashboard "Recent records" panel. */
export interface RecentRecord {
  /** Stable identifier. */
  id: string
  /** Record type/title. */
  title: string
  /** Condensed facility + value, e.g. "Goshen · 1,240 tons". */
  meta: string
  /** Status pill to display. */
  status: Status
}

/** A headline number shown in a dashboard stat card. */
export interface Stat {
  /** Stable identifier. */
  id: string
  /** Overline label, e.g. "Records ready". */
  label: string
  /** The headline figure, e.g. "12". */
  value: string
  /** Supporting caption beneath the figure. */
  caption: string
}

/**
 * An Org as returned by the `GET /orgs` API — the platform-wide Org list shown on
 * the Organizations screen. This is real API data (unlike the prototype constants
 * below), so the shape mirrors the server's `OrgResponse`.
 */
export interface OrgSummary {
  /** Stable identifier (GUID). */
  id: string
  /** Org display name, e.g. "Rieth-Riley". */
  name: string
  /** Entra ID directory GUID when SSO is configured, else null (I-D12). */
  tenantId: string | null
  /** Facilities owned by the Org (I-D06). */
  facilities: { id: string; name: string }[]
}

/** The signed-in Org whose data the prototype displays. */
export const org = { name: 'Rieth-Riley', initials: 'RR' } as const

/** Facilities available in the Facility selector. */
export const facilities: Facility[] = [
  { id: 'goshen', name: 'Goshen Asphalt Plant', state: 'Indiana', regulator: 'IDEM' },
  { id: 'fort-wayne', name: 'Fort Wayne Plant', state: 'Indiana', regulator: 'IDEM' },
  { id: 'indianapolis', name: 'Indianapolis Plant', state: 'Indiana', regulator: 'IDEM' },
]

/** Dashboard compliance summary for the selected Facility. */
export const compliance = {
  regulator: 'IDEM' as Regulator,
  state: 'On track',
  nextFiling: 'Annual Emissions Inventory',
  /** Mobile second line. */
  due: 'Due May 1, 2026 · 12 records ready',
  /** Condensed single line used on tablet/desktop. */
  nextLine: 'Next filing: May 1, 2026',
}

/** Headline figures for the dashboard stat cards (tablet/desktop). */
export const stats: Stat[] = [
  { id: 's1', label: 'Records ready', value: '12', caption: 'for Annual Emissions Inventory' },
  { id: 's2', label: 'Needs attention', value: '3', caption: '2 due soon · 1 overdue' },
]

/** Items rendered under "Needs attention" on the dashboard. */
export const attentionItems: AttentionItem[] = [
  { id: 'a1', title: 'Daily opacity reading', context: 'Goshen · today', status: 'due-soon' },
  { id: 'a2', title: 'Annual Emissions Inventory', context: 'IDEM · due May 1', status: 'due-soon' },
  { id: 'a3', title: 'Baghouse pressure log', context: 'Fort Wayne · 2 days overdue', status: 'overdue' },
]

/** Condensed recent Records for the dashboard "Recent records" panel (tablet/desktop). */
export const recentRecords: RecentRecord[] = [
  { id: 'rr1', title: 'Daily Production Log', meta: 'Goshen · 1,240 tons', status: 'submitted' },
  { id: 'rr2', title: 'Opacity Reading', meta: 'Goshen · 5% avg', status: 'submitted' },
  { id: 'rr3', title: 'Daily Production Log', meta: 'Fort Wayne · 980 tons', status: 'submitted' },
]

/** Default production entries shown on the Log a Record screen. */
export const productionEntries: ProductionEntry[] = [
  { id: 'p1', field: 'Hot Mix', tons: 1240, limit: 1500 },
  { id: 'p2', field: 'Cold Mix', tons: 320, limit: 500 },
  { id: 'p3', field: 'Warm Mix', tons: 0, limit: 800 },
]

/** Field options offered in the production entry dropdowns. */
export const fieldOptions = [
  'Hot Mix',
  'Cold Mix',
  'Warm Mix',
  'Recycled (RAP)',
  'Aggregate',
  'Liquid AC',
  'Fuel burned',
]

/**
 * The last ten days (newest first) covered by the Records production drill-down.
 * Static labels keep the prototype deterministic (no wall-clock dependency).
 */
const LAST_TEN_DAYS = [
  'May 31',
  'May 30',
  'May 29',
  'May 28',
  'May 27',
  'May 26',
  'May 25',
  'May 24',
  'May 23',
  'May 22',
] as const

/**
 * Build ten days of deterministic production figures for a Facility. The plant
 * is idle on one recurring day per cycle (tonnage falls to zero) so the
 * Plant Ran column shows a mix of Yes/No. `seed` varies the figures per Facility.
 */
function buildProductionDays(facilityId: string, seed: number): ProductionDay[] {
  return LAST_TEN_DAYS.map((date, i) => {
    const ran = (i + seed) % 5 !== 4
    const on = ran ? 1 : 0
    return {
      id: `${facilityId}-d${i}`,
      date,
      hotMix: on * (900 + ((i + seed) % 4) * 130),
      coldMix: on * (200 + ((i + seed) % 3) * 60),
      plantRanHours: ran ? 8 + ((i + seed) % 5) * 0.5 : 0,
      steelSlag: on * (140 + ((i + seed) % 5) * 20),
      blastFurnace: on * (110 + ((i + seed) % 4) * 25),
    }
  })
}

/** Last-ten-days production rows per Facility id, for the Records drill-down. */
export const productionByFacility: Record<string, ProductionDay[]> = {
  goshen: buildProductionDays('goshen', 0),
  'fort-wayne': buildProductionDays('fort-wayne', 2),
  indianapolis: buildProductionDays('indianapolis', 3),
}

/** Per-Facility compliance rollups listed on the Records screen. */
export const facilitySummaries: FacilitySummary[] = [
  {
    id: 'goshen',
    name: 'Goshen Asphalt Plant',
    region: 'Indiana · IDEM',
    lastRan: 'May 29',
    lastRecord: 'May 29',
    monthlyDue: 'Jun 15, 2026',
    quarterlyDue: 'Jul 31, 2026',
    status: 'on-track',
  },
  {
    id: 'fort-wayne',
    name: 'Fort Wayne Plant',
    region: 'Indiana · IDEM',
    lastRan: 'May 28',
    lastRecord: 'May 24',
    monthlyDue: 'May 15, 2026',
    quarterlyDue: 'Jul 31, 2026',
    status: 'overdue',
  },
  {
    id: 'indianapolis',
    name: 'Indianapolis Plant',
    region: 'Indiana · IDEM',
    lastRan: 'May 27',
    lastRecord: 'May 27',
    monthlyDue: 'Jun 1, 2026',
    quarterlyDue: 'Jul 31, 2026',
    status: 'due-soon',
  },
]

/** Report filings listed on the IDEM Reports screen. */
export const reports: ReportItem[] = [
  {
    id: 'rep1',
    title: 'Annual Emissions Inventory',
    context: 'Calendar year 2025 · IDEM',
    status: 'due-soon',
    progress: '12 of 12 daily logs ready · due May 1, 2026',
    action: 'Generate report',
  },
  {
    id: 'rep2',
    title: 'Q1 Production Summary',
    context: 'Jan–Mar 2026 · Internal audit',
    status: 'submitted',
    filed: 'Filed Apr 4, 2026',
    action: 'View PDF',
  },
  {
    id: 'rep3',
    title: 'Opacity Compliance Log',
    context: 'April 2026 · IDEM',
    status: 'draft',
    progress: '18 of 30 readings entered',
    action: 'Continue editing',
  },
  {
    id: 'rep4',
    title: 'Stack Test Report',
    context: '2024 · IDEM',
    status: 'submitted',
    filed: 'Filed Nov 12, 2024',
    action: 'View PDF',
  },
  {
    id: 'rep5',
    title: 'SPCC Annual Review',
    context: '2025 · IDEM',
    status: 'due-soon',
    filed: 'Due Jun 15, 2026',
    action: 'Generate report',
  },
  {
    id: 'rep6',
    title: 'Stormwater Inspection Log',
    context: 'Q2 2026 · IDEM',
    status: 'submitted',
    filed: 'Filed Apr 30, 2026',
    action: 'View PDF',
  },
]
