import type { ReactNode } from 'react'
import { AccountMenu } from './AccountMenu'

/** Props for {@link TopBar}. */
export interface TopBarProps {
  /** Title shown on desktop (and on mobile unless {@link TopBarProps.mobileTitle} is set). */
  title: string
  /** Optional title override for mobile/tablet, e.g. the Org name on the dashboard. */
  mobileTitle?: string
  /** Optional supporting line shown beneath the title on desktop only. */
  subtitle?: string
  /** Optional right-aligned actions (e.g. a primary button) shown on desktop only. */
  actions?: ReactNode
  /**
   * Optional control rendered immediately before the title, inline with it —
   * e.g. a back button on a detail screen.
   */
  leading?: ReactNode
}

/**
 * Sticky page header. On mobile it shows a screen title and an account avatar.
 * On desktop it additionally shows a subtitle and any right-aligned actions,
 * while the brand and Facility move into {@link SideNav}.
 */
export function TopBar({ title, mobileTitle, subtitle, actions, leading }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <div className="topbar-title-row">
          {leading}
          <h1 className="topbar-title">
            {mobileTitle ? (
              <>
                <span className="topbar-title-mobile">{mobileTitle}</span>
                <span className="topbar-title-desktop">{title}</span>
              </>
            ) : (
              title
            )}
          </h1>
        </div>
        {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
      </div>

      <div className="topbar-right">
        {actions && <div className="topbar-actions">{actions}</div>}
        <AccountMenu triggerLabel="Open account menu" triggerClassName="topbar-avatar" />
      </div>
    </header>
  )
}
