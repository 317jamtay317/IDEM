import type { Status } from '../data'

/** Human-readable label and tone class for each status value. */
const STATUS_META: Record<Status, { label: string; tone: string }> = {
  submitted: { label: 'Submitted', tone: 'pill-success' },
  draft: { label: 'Draft', tone: 'pill-info' },
  'due-soon': { label: 'Due soon', tone: 'pill-warning' },
  overdue: { label: 'Overdue', tone: 'pill-danger' },
  'on-track': { label: 'On track', tone: 'pill-success' },
}

/** Props for {@link StatusPill}. */
export interface StatusPillProps {
  /** Status to render. */
  status: Status
}

/**
 * A rounded status pill with a leading dot, e.g. "● Submitted".
 * Colour is derived from the status tone defined in the design tokens.
 */
export function StatusPill({ status }: StatusPillProps) {
  const meta = STATUS_META[status]
  return (
    <span className={`pill ${meta.tone}`}>
      <span className="pill-dot" aria-hidden="true" />
      {meta.label}
    </span>
  )
}
