import { HomeIcon, RecordsIcon, ReportsIcon, OrgsIcon, FacilityIcon } from './icons'

/** The primary navigation destinations reachable from the bottom bar / sidebar. */
export type NavTab = 'home' | 'records' | 'facilities' | 'reports' | 'orgs'

/**
 * Which audience a {@link NavEntry} is for. SiteAdmins (I-D13) are platform
 * operators; Org Users are the day-to-day customer users. An entry with no
 * audience is shown to everyone.
 */
export type NavAudience = 'siteAdmin' | 'orgUser'

/** A single navigation destination shared by {@link BottomNav} and {@link SideNav}. */
export interface NavEntry {
  /** Destination key. */
  tab: NavTab
  /** Label shown in the desktop sidebar. */
  label: string
  /** Shorter label shown in the mobile bottom bar. */
  mobileLabel: string
  /** Glyph component. */
  Icon: typeof HomeIcon
  /**
   * The audience this destination is for (I-D13). Omitted means everyone;
   * `'siteAdmin'` shows it only to SiteAdmins, `'orgUser'` only to Org Users.
   */
  audience?: NavAudience
}

/**
 * Ordered navigation destinations. A SiteAdmin (I-D13) is a platform operator
 * who works only with Organizations and Reports, so those are the only entries
 * they ever see; the rest are for Org Users. Account actions (account details,
 * sign out) live in the account menu off the sidebar facility / top-bar avatar,
 * not in a navigation tab.
 */
export const NAV_ENTRIES: NavEntry[] = [
  { tab: 'home', label: 'Dashboard', mobileLabel: 'Home', Icon: HomeIcon, audience: 'orgUser' },
  { tab: 'records', label: 'Records', mobileLabel: 'Records', Icon: RecordsIcon, audience: 'orgUser' },
  { tab: 'facilities', label: 'Facilities', mobileLabel: 'Facilities', Icon: FacilityIcon, audience: 'orgUser' },
  { tab: 'orgs', label: 'Organizations', mobileLabel: 'Orgs', Icon: OrgsIcon, audience: 'siteAdmin' },
  { tab: 'reports', label: 'Reports', mobileLabel: 'Reports', Icon: ReportsIcon },
]

/**
 * The navigation entries to show for the current user. A SiteAdmin (I-D13) sees
 * only their platform destinations (Organizations, Reports); an Org User sees
 * the day-to-day app and never the SiteAdmin-only Organizations screen. This is
 * the single choke point for navigation visibility.
 */
export function visibleNavEntries(isSiteAdmin: boolean): NavEntry[] {
  const role: NavAudience = isSiteAdmin ? 'siteAdmin' : 'orgUser'
  return NAV_ENTRIES.filter((entry) => entry.audience === undefined || entry.audience === role)
}
