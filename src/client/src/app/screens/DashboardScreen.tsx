import {
  attentionItems,
  compliance,
  facilities,
  org,
  recentRecords,
  stats,
  type AttentionItem,
  type RecentRecord,
  type Stat,
} from '../data'
import { StatusPill } from '../components/StatusPill'
import { TopBar } from '../components/TopBar'
import { ChevronRightIcon, PlusIcon } from '../components/icons'
import { useBreakpoint } from '../useBreakpoint'

/** Props for {@link DashboardScreen}. */
export interface DashboardScreenProps {
  /** Invoked when the user activates "Log a Record". */
  onLogRecord: () => void
}

/**
 * Home screen. Mobile shows a Facility selector, compliance hero, a primary
 * "Log a Record" action and a "Needs attention" list. Tablet and desktop add
 * stat cards and a "Recent records" panel, and (on desktop) move the primary
 * action into the top bar.
 */
export function DashboardScreen({ onLogRecord }: DashboardScreenProps) {
  const { isTabletUp, isDesktop } = useBreakpoint()
  const facility = facilities[0]

  return (
    <>
      <TopBar
        title="Dashboard"
        mobileTitle={org.name}
        subtitle={`${facility.name} · ${facility.state} · ${facility.regulator}`}
        actions={
          <button type="button" className="button button-primary" onClick={onLogRecord}>
            <PlusIcon className="button-icon" />
            Log a Record
          </button>
        }
      />

      <div className="screen">
        {!isTabletUp && (
          <>
            <button type="button" className="card facility-card">
              <span className="facility-info">
                <span className="overline">Facility</span>
                <span className="facility-name">{facility.name}</span>
                <span className="muted">
                  {facility.state} · Regulator: {facility.regulator}
                </span>
              </span>
              <ChevronRightIcon className="facility-chevron" />
            </button>

            <HeroCard />

            <button
              type="button"
              className="button button-primary button-block"
              onClick={onLogRecord}
            >
              <PlusIcon className="button-icon" />
              Log a Record
            </button>

            <h2 className="section-title">Needs attention</h2>
            <div className="card-list">
              {attentionItems.map((item) => (
                <div key={item.id} className="card attention-card">
                  <div className="attention-text">
                    <span className="card-title">{item.title}</span>
                    <span className="muted">{item.context}</span>
                  </div>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          </>
        )}

        {isTabletUp && (
          <>
            <div className="dash-stats">
              <HeroCard condensed />
              {!isDesktop && <LogRecordCard onLogRecord={onLogRecord} />}
              {stats.map((stat) => (
                <StatCard key={stat.id} stat={stat} />
              ))}
            </div>

            <div className="dash-panels">
              <AttentionPanel />
              <RecentRecordsPanel />
            </div>
          </>
        )}
      </div>
    </>
  )
}

/** Compliance hero. `condensed` collapses the two mobile lines into one. */
function HeroCard({ condensed = false }: { condensed?: boolean }) {
  return (
    <section className="hero">
      <span className="overline overline-on-dark">{compliance.regulator} compliance</span>
      <span className="hero-state">{compliance.state}</span>
      {condensed ? (
        <span className="hero-line">{compliance.nextLine}</span>
      ) : (
        <>
          <span className="hero-line">Next filing: {compliance.nextFiling}</span>
          <span className="hero-line">{compliance.due}</span>
        </>
      )}
    </section>
  )
}

/** Dark call-to-action card holding the "Log a Record" action (tablet). */
function LogRecordCard({ onLogRecord }: { onLogRecord: () => void }) {
  return (
    <button type="button" className="hero hero-action" onClick={onLogRecord}>
      <PlusIcon className="button-icon" />
      Log a Record
    </button>
  )
}

/** A single headline-figure stat card. */
function StatCard({ stat }: { stat: Stat }) {
  return (
    <section className="card stat-card">
      <span className="overline">{stat.label}</span>
      <span className="stat-value">{stat.value}</span>
      <span className="muted">{stat.caption}</span>
    </section>
  )
}

/** Panel listing the items that need attention (tablet/desktop). */
function AttentionPanel() {
  return (
    <section className="card panel">
      <h2 className="panel-title">Needs attention</h2>
      <div className="panel-rows">
        {attentionItems.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

/** A single row inside {@link AttentionPanel}. */
function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <div className="panel-row">
      <div className="attention-text">
        <span className="card-title">{item.title}</span>
        <span className="muted">{item.context}</span>
      </div>
      <StatusPill status={item.status} />
    </div>
  )
}

/** Panel listing the most recent Records (tablet/desktop). */
function RecentRecordsPanel() {
  return (
    <section className="card panel">
      <h2 className="panel-title">Recent records</h2>
      <div className="panel-rows">
        {recentRecords.map((record) => (
          <RecentRow key={record.id} record={record} />
        ))}
      </div>
    </section>
  )
}

/** A single row inside {@link RecentRecordsPanel}. */
function RecentRow({ record }: { record: RecentRecord }) {
  return (
    <div className="panel-row">
      <div className="attention-text">
        <span className="card-title">{record.title}</span>
        <span className="muted">{record.meta}</span>
      </div>
      <StatusPill status={record.status} />
    </div>
  )
}
