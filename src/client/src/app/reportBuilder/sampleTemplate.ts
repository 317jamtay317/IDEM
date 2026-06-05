/**
 * A representative Report Template used to populate the Report Builder canvas
 * before backend persistence exists (Phase 13). It mirrors the IDEM *Annual
 * Emissions Inventory* design — a title block, columnar detail, a sub-report
 * note and a page footer — so every band and most element types are visible.
 * This is demo scaffolding, not production data; it is replaced by a real load
 * once Report Templates are stored.
 */
import {
  type Band,
  type BandKind,
  type ElementStyle,
  type ReportTemplate,
  createEmptyTemplate,
} from './model'

/**
 * Builds the sample *Annual Emissions Inventory* template.
 *
 * @param id Stable identifier for the template. Defaults to `annual-emissions`.
 * @param name Display name. Defaults to `Annual Emissions Inventory`.
 * @returns A populated {@link ReportTemplate} suitable for previewing the canvas.
 */
export function createSampleTemplate(
  id = 'annual-emissions',
  name = 'Annual Emissions Inventory',
): ReportTemplate {
  const t = createEmptyTemplate(id, name)
  const band = (kind: BandKind): Band => t.bands.find((b) => b.kind === kind)!

  const columnHeader: ElementStyle = { fontSize: 9, fontWeight: 'semibold', color: '#475569' }

  band('reportHeader').elements.push(
    {
      id: 'title',
      type: 'label',
      rect: { x: 0.42, y: 0.44, w: 4, h: 0.34 },
      text: 'Annual Emissions Inventory',
      style: { fontFamily: 'Inter', fontSize: 22, fontWeight: 'semibold', color: '#0f172a' },
    },
    {
      id: 'subtitle',
      type: 'dataField',
      rect: { x: 0.42, y: 0.95, w: 4.8, h: 0.25 },
      text: '{Facility.Name} — Calendar Year {Report.Year}',
      expression: '{Facility.Name}',
      style: { fontSize: 11, color: '#475569' },
    },
    { id: 'logo', type: 'image', rect: { x: 6, y: 0.4, w: 1.6, h: 1 } },
  )

  band('pageHeader').elements.push(
    { id: 'col-field', type: 'label', rect: { x: 0.42, y: 0.07, w: 2, h: 0.22 }, text: 'Field', style: columnHeader },
    {
      id: 'col-tons',
      type: 'label',
      rect: { x: 3.6, y: 0.07, w: 1.6, h: 0.22 },
      text: 'Tons Produced',
      style: columnHeader,
    },
    {
      id: 'col-limit',
      type: 'label',
      rect: { x: 5.4, y: 0.07, w: 1.6, h: 0.22 },
      text: 'Permit Limit',
      style: columnHeader,
    },
    { id: 'header-rule', type: 'line', rect: { x: 0.42, y: 0.32, w: 6.6, h: 0 } },
  )

  band('detail').elements.push(
    {
      id: 'rec-field',
      type: 'dataField',
      rect: { x: 0.42, y: 0.04, w: 2, h: 0.22 },
      text: '{Record.Field}',
      expression: '{Record.Field}',
    },
    {
      id: 'rec-tons',
      type: 'dataField',
      rect: { x: 3.6, y: 0.04, w: 1.2, h: 0.22 },
      text: '{Record.Tons}',
      expression: '{Record.Tons}',
    },
    {
      id: 'rec-limit',
      type: 'dataField',
      rect: { x: 5.4, y: 0.04, w: 1.2, h: 0.22 },
      text: '{Record.Limit}',
      expression: '{Record.Limit}',
    },
  )

  band('subReport').elements.push(
    {
      id: 'sub-title',
      type: 'label',
      rect: { x: 0.42, y: 0.12, w: 3.5, h: 0.24 },
      text: 'Opacity Readings (Method 9)',
      style: { fontSize: 11, fontWeight: 'semibold', color: '#0f172a' },
    },
    {
      id: 'sub-ref',
      type: 'dataField',
      rect: { x: 0.42, y: 0.46, w: 4, h: 0.22 },
      text: '{SubReport.opacity_detail}',
      expression: '{SubReport.opacity_detail}',
      style: { fontSize: 10, italic: true, color: '#64748b' },
    },
    {
      id: 'total-tons',
      type: 'formula',
      rect: { x: 4.6, y: 0.12, w: 2.5, h: 0.24 },
      text: 'SUM({Record.Tons})',
      expression: 'SUM({Record.Tons})',
      style: { fontSize: 11, fontWeight: 'semibold', align: 'right', color: '#0f172a' },
    },
    { id: 'sub-frame', type: 'rectangle', rect: { x: 0.32, y: 0.04, w: 6.8, h: 0.9 } },
  )

  band('pageFooter').elements.push(
    { id: 'footer-rule', type: 'line', rect: { x: 0.42, y: 0, w: 6.6, h: 0 } },
    {
      id: 'generated',
      type: 'dataField',
      rect: { x: 0.42, y: 0.08, w: 2.6, h: 0.22 },
      text: 'Generated {Report.Date}',
      expression: '{Report.Date}',
      style: { fontSize: 9, color: '#64748b' },
    },
    {
      id: 'company',
      type: 'label',
      rect: { x: 3.6, y: 0.08, w: 1.4, h: 0.22 },
      text: 'Rieth-Riley',
      style: { fontSize: 9, fontWeight: 'semibold', align: 'center', color: '#475569' },
    },
    // The page number itself is document chrome driven by template.pageNumbers
    // (Phase 11), rendered by the canvas in this footer — not a placed element.
  )

  return t
}
