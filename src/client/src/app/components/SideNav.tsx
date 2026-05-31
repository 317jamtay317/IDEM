import { facilities, org } from '../data'
import { visibleNavEntries, type NavTab } from './nav'

/** Props for {@link SideNav}. */
export interface SideNavProps {
  /** The currently active tab, highlighted in the rail. */
  active: NavTab
  /** Whether the signed-in user is a SiteAdmin; controls SiteAdmin-only destinations. */
  isSiteAdmin: boolean
  /** Called with the chosen tab when the user clicks a destination. */
  onNavigate: (tab: NavTab) => void
}

/**
 * Desktop sidebar navigation (≥ 1024px): Org brand mark, the primary
 * destinations as full-width rows, and the selected Facility pinned to the
 * bottom. Hidden below desktop width, where {@link BottomNav} takes over.
 */
export function SideNav({ active, isSiteAdmin, onNavigate }: SideNavProps) {
  const facility = facilities[0]

  return (
    <aside className="sidenav" aria-label="Primary">
      <div className="sidenav-brand">
        <span className="sidenav-logo" aria-hidden="true">
          {org.initials}
        </span>
        <span className="sidenav-brand-name">{org.name}</span>
      </div>

      <nav className="sidenav-links">
        {visibleNavEntries(isSiteAdmin).map(({ tab, label, Icon }) => (
          <button
            key={tab}
            type="button"
            className={`sidenav-item${active === tab ? ' sidenav-item-active' : ''}`}
            aria-current={active === tab ? 'page' : undefined}
            onClick={() => onNavigate(tab)}
          >
            <Icon className="sidenav-icon" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidenav-facility">
        <span className="overline">Facility</span>
        <span className="sidenav-facility-name">{facility.name}</span>
        <span className="muted">
          {facility.state} · {facility.regulator}
        </span>
      </div>
    </aside>
  )
}
