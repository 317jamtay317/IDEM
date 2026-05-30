import { HomeIcon, RecordsIcon, ReportsIcon, MoreIcon } from './icons'

/** The primary navigation destinations reachable from the bottom bar / sidebar. */
export type NavTab = 'home' | 'records' | 'reports' | 'more'

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
}

/** Ordered navigation destinations. */
export const NAV_ENTRIES: NavEntry[] = [
  { tab: 'home', label: 'Dashboard', mobileLabel: 'Home', Icon: HomeIcon },
  { tab: 'records', label: 'Records', mobileLabel: 'Records', Icon: RecordsIcon },
  { tab: 'reports', label: 'Reports', mobileLabel: 'Reports', Icon: ReportsIcon },
  { tab: 'more', label: 'More', mobileLabel: 'More', Icon: MoreIcon },
]
