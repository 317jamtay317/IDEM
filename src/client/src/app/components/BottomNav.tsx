import { visibleNavEntries, type NavTab } from './nav'

export type { NavTab }

/** Props for {@link BottomNav}. */
export interface BottomNavProps {
  /** The currently active tab, highlighted in the bar. */
  active: NavTab
  /** Whether the signed-in user is a SiteAdmin; controls SiteAdmin-only destinations. */
  isSiteAdmin: boolean
  /** Called with the chosen tab when the user taps a destination. */
  onNavigate: (tab: NavTab) => void
}

/**
 * Fixed bottom navigation bar (mobile and tablet). Hidden at desktop width,
 * where {@link SideNav} takes over. Each target is a 44px-minimum touch target.
 */
export function BottomNav({ active, isSiteAdmin, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {visibleNavEntries(isSiteAdmin).map(({ tab, mobileLabel, Icon }) => (
        <button
          key={tab}
          type="button"
          className={`nav-item${active === tab ? ' nav-item-active' : ''}`}
          aria-current={active === tab ? 'page' : undefined}
          onClick={() => onNavigate(tab)}
        >
          <Icon className="nav-icon" />
          <span className="nav-label">{mobileLabel}</span>
        </button>
      ))}
    </nav>
  )
}
