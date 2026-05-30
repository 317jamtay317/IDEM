/**
 * In-memory sample data for the UI prototype.
 *
 * Everything here is fake and exists only to drive the screens visually while
 * the real API endpoints are built. Names follow the project ubiquitous
 * language (Org, Facility, Record, Report, Regulator, IDEM, Rieth-Riley).
 */

/** A regulatory body a Facility reports to. */
export type Regulator = 'IDEM' | 'MDEQ'

/** Lifecycle/compliance status shared by Records and Reports, rendered as a pill. */
export type Status = 'submitted' | 'draft' | 'due-soon' | 'overdue'

/** Record category used by the filter chips. */
export type RecordCategory = 'Production' | 'Opacity' | 'Baghouse' | 'Stack test'

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

/** A single submitted (or missing) Record, shown as a card or a table row. */
export interface RecordItem {
  /** Stable identifier. */
  id: string
  /** Record type/title, e.g. "Daily Production Log". */
  type: string
  /** Facility the Record belongs to. */
  facility: string
  /** Operator who logged it, or null when not recorded. */
  operator: string | null
  /** Headline figures or a "Not recorded" note. */
  value: string
  /** Short date label, e.g. "May 29". */
  date: string
  /** Day bucket the Record is grouped under on mobile, e.g. "Today · May 29". */
  dayGroup: string
  /** Current status of the Record. */
  status: Status
  /** Category used by the filter chips. */
  category: RecordCategory
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

/** Filter chips available on the Records screen. */
export const recordFilters = ['All', 'Production', 'Opacity', 'Baghouse', 'Stack test'] as const

/** Records listed on the Records screen, newest first. */
export const records: RecordItem[] = [
  {
    id: 'r1',
    type: 'Daily Production Log',
    facility: 'Goshen Asphalt Plant',
    operator: 'J. Tays',
    value: '1,240 tons · 820 gal fuel',
    date: 'May 29',
    dayGroup: 'Today · May 29',
    status: 'submitted',
    category: 'Production',
  },
  {
    id: 'r2',
    type: 'Opacity Reading (M9)',
    facility: 'Goshen Asphalt Plant',
    operator: 'J. Tays',
    value: '5% avg · within limit',
    date: 'May 29',
    dayGroup: 'Today · May 29',
    status: 'submitted',
    category: 'Opacity',
  },
  {
    id: 'r3',
    type: 'Daily Production Log',
    facility: 'Fort Wayne Plant',
    operator: 'M. Reed',
    value: '980 tons · 640 gal fuel',
    date: 'May 28',
    dayGroup: 'Yesterday · May 28',
    status: 'submitted',
    category: 'Production',
  },
  {
    id: 'r4',
    type: 'Baghouse Pressure Log',
    facility: 'Fort Wayne Plant',
    operator: null,
    value: 'Not recorded',
    date: 'May 28',
    dayGroup: 'Yesterday · May 28',
    status: 'overdue',
    category: 'Baghouse',
  },
  {
    id: 'r5',
    type: 'Opacity Reading (M9)',
    facility: 'Indianapolis Plant',
    operator: 'A. Cole',
    value: 'Draft saved',
    date: 'May 27',
    dayGroup: 'May 27',
    status: 'draft',
    category: 'Opacity',
  },
  {
    id: 'r6',
    type: 'Daily Production Log',
    facility: 'Indianapolis Plant',
    operator: 'A. Cole',
    value: '1,050 tons · 700 gal fuel',
    date: 'May 27',
    dayGroup: 'May 27',
    status: 'submitted',
    category: 'Production',
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
