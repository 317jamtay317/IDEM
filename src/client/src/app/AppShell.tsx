import { useEffect, useMemo } from 'react'
import { BottomNav } from './components/BottomNav'
import { SideNav } from './components/SideNav'
import { AccountProvider } from './components/AccountMenu'
import { visibleNavEntries, type NavTab } from './components/nav'
import { useHashScreen, type Screen } from './useHashScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { RecordsScreen } from './screens/RecordsScreen'
import { ReportsScreen } from './screens/ReportsScreen'
import { OrgsScreen } from './screens/OrgsScreen'
import { FacilitiesScreen } from './screens/FacilitiesScreen'
import { FacilityDetailScreen } from './screens/FacilityDetailScreen'
import { LogRecordScreen } from './screens/LogRecordScreen'
import './app.css'

/** Props for {@link AppShell}. */
export interface AppShellProps {
  /** Email of the signed-in user, shown in the account menu. */
  email: string | null
  /** Whether the signed-in user is a SiteAdmin (I-D13). */
  isSiteAdmin: boolean
  /** Bearer access token, forwarded to screens that call the API (e.g. Organizations). */
  accessToken?: string | null
  /** Invoked when the user chooses to sign out. */
  onSignOut: () => void
}

/** The navigation tab that governs a screen — `log` belongs to the dashboard (home). */
function tabForScreen(screen: Screen): NavTab {
  return screen === 'log' ? 'home' : screen
}

/**
 * The authenticated application shell. Owns the active-screen state and renders
 * the current screen plus the responsive navigation: a bottom bar on
 * mobile/tablet and a sidebar on desktop. Navigation and the reachable screens
 * are role-scoped (I-D13): a SiteAdmin sees only Organizations and Reports,
 * while an Org User sees the day-to-day app and never the Organizations screen.
 */
export function AppShell({ email, isSiteAdmin, accessToken = null, onSignOut }: AppShellProps) {
  const [screen, navigate, facilityId, openFacility] = useHashScreen()

  // The destinations this user may reach, and their landing screen (the first).
  const permitted = useMemo(() => visibleNavEntries(isSiteAdmin), [isSiteAdmin])
  const homeTab = permitted[0].tab
  const allowed = permitted.some((entry) => entry.tab === tabForScreen(screen))

  // I-D13: redirect a hash that points outside the user's navigation to their
  // landing screen, so a forbidden screen can't be reached by editing the URL.
  useEffect(() => {
    if (!allowed) navigate(homeTab)
  }, [allowed, homeTab, navigate])

  // Render the landing screen rather than a forbidden one while the redirect
  // above settles, so a disallowed screen never flashes.
  const effectiveScreen: Screen = allowed ? screen : homeTab
  const activeTab = tabForScreen(effectiveScreen)

  return (
    <AccountProvider value={{ email, isSiteAdmin, onSignOut }}>
      <div className="app-shell">
        <SideNav active={activeTab} isSiteAdmin={isSiteAdmin} onNavigate={navigate} />

        <div className="app-content">
          <main className="app-main">
            {effectiveScreen === 'home' && <DashboardScreen onLogRecord={() => navigate('log')} />}
            {effectiveScreen === 'log' && <LogRecordScreen />}
            {effectiveScreen === 'records' && <RecordsScreen />}
            {effectiveScreen === 'reports' && <ReportsScreen />}
            {effectiveScreen === 'orgs' && <OrgsScreen accessToken={accessToken} />}
            {effectiveScreen === 'facilities' &&
              (facilityId ? (
                <FacilityDetailScreen
                  facilityId={facilityId}
                  accessToken={accessToken}
                  onBack={() => navigate('facilities')}
                />
              ) : (
                <FacilitiesScreen accessToken={accessToken} onOpenFacility={openFacility} />
              ))}
          </main>

          <BottomNav active={activeTab} isSiteAdmin={isSiteAdmin} onNavigate={navigate} />
        </div>
      </div>
    </AccountProvider>
  )
}
