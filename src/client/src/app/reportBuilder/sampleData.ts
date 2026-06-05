/**
 * Sample bindable fields and a sample {@link DataContext} for the Report Builder.
 * These stand in for the real field catalog and Report data until the Report
 * Engine and backend exist (Phase 13): the Data Field dropdown lists
 * {@link SAMPLE_FIELDS}, and the Data binding editor previews expressions against
 * {@link SAMPLE_DATA_CONTEXT}. The values mirror the *Annual Emissions Inventory*
 * sample template (see `sampleTemplate.ts`) so every expression it authors both
 * validates and evaluates cleanly.
 */
import { type DataContext, type DataFieldDef } from './expressions'

/**
 * The fields the Report Builder offers for binding, across the report's scopes —
 * the singular Org / Facility / Report / Sub Report values and the per-row
 * Record (detail) fields. Only detail fields may be aggregated by a function.
 */
export const SAMPLE_FIELDS: DataFieldDef[] = [
  { scope: 'Org', field: 'Name', label: 'Name', isDetail: false },
  { scope: 'Facility', field: 'Name', label: 'Name', isDetail: false },
  { scope: 'Facility', field: 'PermitNumber', label: 'Permit Number', isDetail: false },
  { scope: 'Report', field: 'Year', label: 'Year', isDetail: false },
  { scope: 'Report', field: 'Date', label: 'Date', isDetail: false },
  { scope: 'Record', field: 'Field', label: 'Field', isDetail: true },
  { scope: 'Record', field: 'Tons', label: 'Tons Produced', isDetail: true },
  { scope: 'Record', field: 'Limit', label: 'Permit Limit', isDetail: true },
  { scope: 'SubReport', field: 'opacity_detail', label: 'Opacity Detail', isDetail: false },
]

/**
 * Builds a fresh sample {@link DataContext} mirroring the *Annual Emissions
 * Inventory* template: Rieth-Riley's Goshen plant for a calendar year, with three
 * Production Field detail rows and a three-page report.
 *
 * @returns A new {@link DataContext}; equal in value to {@link SAMPLE_DATA_CONTEXT}.
 */
export function createSampleDataContext(): DataContext {
  return {
    scopes: {
      Org: { Name: 'Rieth-Riley Construction Co.' },
      Facility: { Name: 'Goshen Asphalt Plant', PermitNumber: 'IN-018-00042' },
      Report: { Year: '2025', Date: 'March 12, 2026' },
      SubReport: { opacity_detail: '(opacity readings)' },
    },
    detailScope: 'Record',
    detail: [
      { Field: 'Hot Mix', Tons: 1280.5, Limit: 2000 },
      { Field: 'Cold Mix', Tons: 642.25, Limit: 1000 },
      { Field: 'Steel Slag', Tons: 318, Limit: 500 },
    ],
    page: { number: 1, total: 3 },
  }
}

/** A shared sample {@link DataContext} for previewing expressions. */
export const SAMPLE_DATA_CONTEXT: DataContext = createSampleDataContext()
