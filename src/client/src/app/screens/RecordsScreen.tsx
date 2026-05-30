import { useState } from 'react'
import { facilities, recordFilters, records, type RecordItem } from '../data'
import { StatusPill } from '../components/StatusPill'
import { TopBar } from '../components/TopBar'
import { useBreakpoint } from '../useBreakpoint'

type Filter = (typeof recordFilters)[number]

/** Join a Record's facility, operator and (optionally) date into a context line. */
function contextLine(record: RecordItem, withDate: boolean): string {
  return [record.facility, record.operator, withDate ? record.date : null]
    .filter(Boolean)
    .join(' · ')
}

/** Group records by their day bucket, preserving source order. */
function groupByDay(items: RecordItem[]): [string, RecordItem[]][] {
  const groups = new Map<string, RecordItem[]>()
  for (const item of items) {
    const bucket = groups.get(item.dayGroup) ?? []
    bucket.push(item)
    groups.set(item.dayGroup, bucket)
  }
  return [...groups.entries()]
}

/**
 * Records screen. Category chips filter the list at every breakpoint. Mobile
 * shows day-grouped cards, tablet a two-column card grid, and desktop a data
 * table.
 */
export function RecordsScreen() {
  const { isTabletUp, isDesktop } = useBreakpoint()
  const [filter, setFilter] = useState<Filter>('All')

  const visible = filter === 'All' ? records : records.filter((r) => r.category === filter)

  return (
    <>
      <TopBar title="Records" subtitle={`All compliance records · ${facilities[0].name}`} />

      <div className="screen">
        <div className="chip-row" role="tablist" aria-label="Filter records">
          {recordFilters.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={`chip${filter === f ? ' chip-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {isDesktop ? (
          <RecordTable items={visible} />
        ) : isTabletUp ? (
          <div className="record-grid">
            {visible.map((item) => (
              <RecordCard key={item.id} item={item} withDate />
            ))}
          </div>
        ) : (
          groupByDay(visible).map(([day, items]) => (
            <section key={day} className="record-group">
              <h2 className="group-label">{day}</h2>
              <div className="card-list">
                {items.map((item) => (
                  <RecordCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}

/** A Record rendered as a card (mobile and tablet). */
function RecordCard({ item, withDate = false }: { item: RecordItem; withDate?: boolean }) {
  return (
    <div className="card record-card">
      <div className="record-head">
        <span className="card-title">{item.type}</span>
        <StatusPill status={item.status} />
      </div>
      <span className="muted">{contextLine(item, withDate)}</span>
      <span className="record-detail">{item.value}</span>
    </div>
  )
}

/** Records rendered as a data table (desktop). */
function RecordTable({ items }: { items: RecordItem[] }) {
  return (
    <div className="card table-card">
      <table className="record-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Facility</th>
            <th>Operator</th>
            <th>Value</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="cell-strong">{item.type}</td>
              <td className="muted">{item.facility}</td>
              <td className="muted">{item.operator ?? '—'}</td>
              <td className="cell-strong">{item.value}</td>
              <td className="muted">{item.date}</td>
              <td>
                <StatusPill status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
