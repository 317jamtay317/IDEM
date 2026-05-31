import { HomeIcon, RecordsIcon, ReportsIcon, OrgsIcon, MoreIcon } from './icons'

/** The primary navigation destinations reachable from the bottom bar / sidebar. */
export type NavTab = 'home' | 'records' | 'reports' | 'orgs' | 'more'

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
   * When true, this destination is only relevant to platform SiteAdmins (I-D13).
   * Navigation is not yet role-filtered — see {@link visibleNavEntries} — but this
   * flag lets a later roles/permissions session gate entries without restructuring.
   */
  siteAdminOnly?: boolean
}

/** Ordered navigation destinations. */
export const NAV_ENTRIES: NavEntry[] = [
  { tab: 'home', label: 'Dashboard', mobileLabel: 'Home', Icon: HomeIcon },
  { tab: 'records', label: 'Records', mobileLabel: 'Records', Icon: RecordsIcon },
  { tab: 'reports', label: 'Reports', mobileLabel: 'Reports', Icon: ReportsIcon },
  { tab: 'orgs', label: 'Organizations', mobileLabel: 'Orgs', Icon: OrgsIcon, siteAdminOnly: true },
  { tab: 'more', label: 'More', mobileLabel: 'More', Icon: MoreIcon },
]

/**
 * The navigation entries to show for the current user. SiteAdmin-only entries
 * (I-D13) are hidden from non-SiteAdmins. This is the single choke point for
 * navigation visibility; a later roles/permissions session can extend it to
 * richer role checks without touching the nav components.
 */
export function visibleNavEntries(isSiteAdmin: boolean): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => isSiteAdmin || !entry.siteAdminOnly)
}
