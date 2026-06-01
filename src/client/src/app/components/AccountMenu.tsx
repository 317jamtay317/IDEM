import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { org } from '../data'

/** The signed-in account exposed to the {@link AccountMenu}. */
export interface AccountInfo {
  /** Email of the signed-in user. */
  email: string | null
  /** Whether the signed-in user is a SiteAdmin (I-D13). */
  isSiteAdmin: boolean
  /** Invoked when the user chooses to sign out. */
  onSignOut: () => void
}

const AccountContext = createContext<AccountInfo | null>(null)

/** Props for {@link AccountProvider}. */
export interface AccountProviderProps {
  /** The signed-in account shared with every {@link AccountMenu} below. */
  value: AccountInfo
  /** The subtree that may render an {@link AccountMenu}. */
  children: ReactNode
}

/**
 * Shares the signed-in {@link AccountInfo} with the {@link AccountMenu}s in the
 * shell (the sidebar facility and the top-bar avatar) without threading it
 * through every screen.
 */
export function AccountProvider({ value, children }: AccountProviderProps) {
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

/** Where the popover opens relative to its trigger. */
export type AccountMenuPlacement = 'up' | 'down'

/** Props for {@link AccountMenu}. */
export interface AccountMenuProps {
  /** Accessible label for the trigger, which has no visible text of its own. */
  triggerLabel: string
  /** Class applied to the trigger so callers control its appearance. */
  triggerClassName?: string
  /** Whether the popover opens above (`'up'`) or below (`'down'`) the trigger. Defaults to `'down'`. */
  placement?: AccountMenuPlacement
  /** Optional visual content of the trigger (e.g. the facility block). */
  children?: ReactNode
}

/**
 * A trigger that opens a small popover showing the signed-in account and a Sign
 * out action. The menu closes on Escape, on an outside press, and after signing
 * out. The account comes from {@link AccountProvider}; with no provider the
 * trigger degrades to a non-interactive marker so it can still render in
 * isolation (e.g. a screen rendered on its own in a test).
 */
export function AccountMenu({
  triggerLabel,
  triggerClassName,
  placement = 'down',
  children,
}: AccountMenuProps) {
  const account = useContext(AccountContext)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    // Dismiss when intent leaves the menu: an outside press or the Escape key.
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // No account in context: show the trigger's content as a non-interactive
  // marker — there is nothing to sign out of.
  if (!account) {
    return (
      <span className={triggerClassName} role="img" aria-label={triggerLabel}>
        {children}
      </span>
    )
  }

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {children}
      </button>

      {open && (
        <div className={`account-menu-popover account-menu-popover-${placement}`}>
          <div className="account-menu-info">
            <span className="overline">Signed in as</span>
            <span className="account-menu-email">{account.email ?? 'Unknown user'}</span>
            <span className="muted">{org.name}</span>
            {account.isSiteAdmin && <span className="badge">SiteAdmin</span>}
          </div>
          <button
            type="button"
            className="button button-secondary button-block"
            onClick={() => {
              setOpen(false)
              account.onSignOut()
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
