import { useCallback, useEffect, useState } from 'react'
import { type NavTab } from './components/nav'

/**
 * Every screen the {@link AppShell} can render. The four {@link NavTab}
 * destinations plus `log`, which is reached from the dashboard rather than the
 * primary navigation.
 */
export type Screen = NavTab | 'log'

/**
 * The screens that may appear in the URL hash. Renaming or removing a
 * {@link NavTab} is caught here at compile time; only additions need a manual
 * entry (an unknown hash simply falls back to `home`).
 */
const SCREENS: readonly Screen[] = ['home', 'records', 'reports', 'orgs', 'productionFields', 'fieldLimits', 'log', 'facilities']

/**
 * Parses the active {@link Screen} out of a location hash. The bare (`#`), root
 * (`#/`) and empty hashes are the home screen; an unrecognised destination
 * falls back to `home` so a stale or hand-edited URL can never wedge the app.
 *
 * @param hash The `window.location.hash` value, e.g. `#/records`.
 * @returns The screen the hash names, or `home` when it names none.
 */
export function screenFromHash(hash: string): Screen {
  // Drop the leading `#` (and its optional `/`), then take the first segment.
  const segment = hash.replace(/^#\/?/, '').split('/')[0]
  return (SCREENS as readonly string[]).includes(segment) ? (segment as Screen) : 'home'
}

/**
 * Builds the location hash that represents a {@link Screen}. `home` maps to the
 * root hash (`#/`) so the address bar stays clean on the default screen.
 *
 * @param screen The screen to encode.
 * @returns The hash string, e.g. `#/records`.
 */
export function hashFromScreen(screen: Screen): string {
  return screen === 'home' ? '#/' : `#/${screen}`
}

/**
 * Tracks the active {@link Screen} in the URL hash so it survives a page
 * refresh and can be linked to directly. The initial screen is read from the
 * current hash; navigating mirrors the new screen into the hash, and external
 * hash changes (the browser back/forward buttons) flow back into state.
 *
 * @returns A tuple of the active screen and a `navigate(screen)` setter.
 */
export function useHashScreen(): readonly [Screen, (screen: Screen) => void] {
  const [screen, setScreen] = useState<Screen>(() => screenFromHash(window.location.hash))

  useEffect(() => {
    // Subscribe to hash changes the app didn't initiate — chiefly the browser
    // back/forward buttons. The initial screen is already set from the hash by
    // the lazy state initializer above.
    const sync = () => setScreen(screenFromHash(window.location.hash))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const navigate = useCallback((next: Screen) => {
    // Switch immediately for a snappy transition, then mirror the screen into
    // the URL so a refresh or shared link lands on it. The resulting
    // `hashchange` re-runs `sync`, a no-op since state already matches.
    setScreen(next)
    const targetHash = hashFromScreen(next)
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
  }, [])

  return [screen, navigate]
}
