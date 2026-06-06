import { useEffect, useMemo } from 'react'
import { BottomNav } from './components/BottomNav'
import { SideNav } from './components/SideNav'
import { AccountProvider } from './components/AccountMenu'
import { visibleNavEntries, type NavTab } from './components/nav'
import { useHashScreen, type Screen } from './useHashScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { RecordsScreen } from './screens/RecordsScreen'
import { ReportsScreen } from './screens/ReportsScreen'
import { ReportBuilderScreen } from './screens/ReportBuilderScreen'
import { ReportPreviewScreen } from './screens/ReportPreviewScreen'
import { OrgsScreen } from './screens/OrgsScreen'
import { FacilitiesScreen } from './screens/FacilitiesScreen'
import { FacilityDetailScreen } from './screens/FacilityDetailScreen'
import { LogRecordScreen } from './screens/LogRecordScreen'
import { ProductionFieldsScreen } from './screens/ProductionFieldsScreen'
import { FieldLimitsScreen } from './screens/FieldLimitsScreen'
import { reportTemplatesApi } from './reportTemplatesApi'
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

/**
 * The navigation tab that governs a screen. Logging a Record is a Records
 * activity, so `log` highlights Records; the SiteAdmin Report Builder is reached
 * from Reports, so `report-builder` highlights Reports.
 */
function tabForScreen(screen: Screen): NavTab {
  if (screen === 'log') return 'records'
  if (screen === 'report-builder' || screen === 'report-preview') return 'reports'
  return screen
}

/**
 * The authenticated application shell. Owns the active-screen state and renders
 * the current screen plus the responsive navigation: a bottom bar on
 * mobile/tablet and a sidebar on desktop. Navigation and the reachable screens
 * are role-scoped (I-D13): a SiteAdmin sees only Organizations and Reports (and
 * the SiteAdmin-only Report Builder reached from Reports), while an Org User
 * sees the day-to-day app and never the Organizations screen or Report Builder.
 */
export function AppShell({ email, isSiteAdmin, accessToken = null, onSignOut }: AppShellProps) {
  const [screen, navigate, detailId, openFacility] = useHashScreen()

  // The destinations this user may reach, and their landing screen (the first).
  const permitted = useMemo(() => visibleNavEntries(isSiteAdmin), [isSiteAdmin])
  const homeTab = permitted[0].tab

  // A screen is reachable when its governing tab is in the user's navigation and,
  // for the SiteAdmin-only Report Builder and live preview (I-D13), when the user
  // is a SiteAdmin.
  const allowed =
    permitted.some((entry) => entry.tab === tabForScreen(screen)) &&
    ((screen !== 'report-builder' && screen !== 'report-preview') || isSiteAdmin)

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
            {effectiveScreen === 'log' && (
              <LogRecordScreen
                accessToken={accessToken}
                onManageFacilities={() => navigate('facilities')}
              />
            )}
            {effectiveScreen === 'records' && <RecordsScreen accessToken={accessToken} />}
            {effectiveScreen === 'reports' && (
              <ReportsScreen
                isSiteAdmin={isSiteAdmin}
                accessToken={accessToken}
                onOpenReportBuilder={(id) => navigate('report-builder', id)}
              />
            )}
            {effectiveScreen === 'report-builder' && (
              <ReportBuilderScreen
                templateId={detailId}
                api={reportTemplatesApi}
                accessToken={accessToken}
                onSaved={(id) => navigate('report-builder', id)}
                onClose={() => navigate('reports')}
              />
            )}
            {effectiveScreen === 'report-preview' && (
              <ReportPreviewScreen
                key={detailId ?? 'none'}
                sessionId={detailId}
                accessToken={accessToken}
                onClose={() => navigate('reports')}
              />
            )}
            {effectiveScreen === 'orgs' && <OrgsScreen accessToken={accessToken} />}
            {effectiveScreen === 'productionFields' && (
              <ProductionFieldsScreen accessToken={accessToken} />
            )}
            {effectiveScreen === 'facilities' &&
              (detailId ? (
                <FacilityDetailScreen
                  facilityId={detailId}
                  accessToken={accessToken}
                  onBack={() => navigate('facilities')}
                />
              ) : (
                <FacilitiesScreen accessToken={accessToken} onOpenFacility={openFacility} />
              ))}
            {effectiveScreen === 'fieldLimits' && <FieldLimitsScreen accessToken={accessToken} />}
          </main>

          <BottomNav active={activeTab} isSiteAdmin={isSiteAdmin} onNavigate={navigate} />
        </div>
      </div>
    </AccountProvider>
  )
}
