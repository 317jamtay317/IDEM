import { BottomNav } from './components/BottomNav'
import { SideNav } from './components/SideNav'
import { TopBar } from './components/TopBar'
import type { NavTab } from './components/nav'
import { useHashScreen } from './useHashScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { RecordsScreen } from './screens/RecordsScreen'
import { ReportsScreen } from './screens/ReportsScreen'
import { OrgsScreen } from './screens/OrgsScreen'
import { LogRecordScreen } from './screens/LogRecordScreen'
import { org } from './data'
import './app.css'

/** Props for {@link AppShell}. */
export interface AppShellProps {
  /** Email of the signed-in user, shown on the More screen. */
  email: string | null
  /** Whether the signed-in user is a SiteAdmin. */
  isSiteAdmin: boolean
  /** Bearer access token, forwarded to screens that call the API (e.g. Organizations). */
  accessToken?: string | null
  /** Invoked when the user chooses to sign out. */
  onSignOut: () => void
}

/**
 * The authenticated application shell. Owns the active-screen state and renders
 * the current screen plus the responsive navigation: a bottom bar on
 * mobile/tablet and a sidebar on desktop.
 */
export function AppShell({ email, isSiteAdmin, accessToken = null, onSignOut }: AppShellProps) {
  const [screen, navigate] = useHashScreen()
  const activeTab: NavTab = screen === 'log' ? 'home' : screen

  return (
    <div className="app-shell">
      <SideNav active={activeTab} isSiteAdmin={isSiteAdmin} onNavigate={navigate} />

      <div className="app-content">
        <main className="app-main">
          {screen === 'home' && <DashboardScreen onLogRecord={() => navigate('log')} />}
          {screen === 'log' && <LogRecordScreen />}
          {screen === 'records' && <RecordsScreen />}
          {screen === 'reports' && <ReportsScreen />}
          {screen === 'orgs' && <OrgsScreen accessToken={accessToken} />}
          {screen === 'more' && (
            <MoreScreen email={email} isSiteAdmin={isSiteAdmin} onSignOut={onSignOut} />
          )}
        </main>

        <BottomNav active={activeTab} isSiteAdmin={isSiteAdmin} onNavigate={navigate} />
      </div>
    </div>
  )
}

/** Account/settings screen reached from the "More" tab. */
function MoreScreen({ email, isSiteAdmin, onSignOut }: AppShellProps) {
  return (
    <>
      <TopBar title="More" subtitle="Account & settings" />
      <div className="screen screen-narrow">
        <div className="card account-card">
          <span className="overline">Signed in as</span>
          <span className="card-title account-email">{email ?? 'Unknown user'}</span>
          <span className="muted">{org.name}</span>
          {isSiteAdmin && <span className="badge">SiteAdmin</span>}
        </div>
        <button type="button" className="button button-secondary button-block" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </>
  )
}
