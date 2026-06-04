import { useCallback, useEffect, useState } from 'react'
import { type NavTab } from './components/nav'

/**
 * Every screen the {@link AppShell} can render: the {@link NavTab} destinations
 * plus `log` (reached from the dashboard) and `report-builder` (the SiteAdmin
 * Report Builder, reached by opening a Report Template from the Reports screen).
 */
export type Screen = NavTab | 'log' | 'report-builder'

/**
 * The screens that may appear in the URL hash. Renaming or removing a
 * {@link NavTab} is caught here at compile time; only additions need a manual
 * entry (an unknown hash simply falls back to `home`).
 */
const SCREENS: readonly Screen[] = [
  'home',
  'records',
  'reports',
  'orgs',
  'log',
  'facilities',
  'report-builder',
]

/** The screen segment that opens the Report Builder, e.g. `#/report-builder/{id}`. */
const REPORT_BUILDER: Screen = 'report-builder'

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
 * Extracts the Report Template id carried by a Report Builder hash. The builder
 * route is `#/report-builder/{templateId}`; the id is the second path segment
 * and is percent-decoded. Any other hash — including a bare `#/report-builder`
 * with no id — has no template id.
 *
 * @param hash The `window.location.hash` value, e.g. `#/report-builder/annual-emissions`.
 * @returns The decoded template id, or `null` when the hash names no builder template.
 */
export function templateIdFromHash(hash: string): string | null {
  const segments = hash.replace(/^#\/?/, '').split('/')
  if (segments[0] !== REPORT_BUILDER) return null
  const id = segments[1]
  return id ? decodeURIComponent(id) : null
}

/**
 * Builds the location hash that represents a {@link Screen}. `home` maps to the
 * root hash (`#/`) so the address bar stays clean on the default screen. A
 * `templateId` given for the `report-builder` screen is percent-encoded into
 * the hash (`#/report-builder/{templateId}`).
 *
 * @param screen The screen to encode.
 * @param templateId The Report Template id; used only for the `report-builder` screen.
 * @returns The hash string, e.g. `#/records` or `#/report-builder/annual-emissions`.
 */
export function hashFromScreen(screen: Screen, templateId?: string): string {
  if (screen === 'home') return '#/'
  if (screen === REPORT_BUILDER && templateId) {
    return `#/${REPORT_BUILDER}/${encodeURIComponent(templateId)}`
  }
  return `#/${screen}`
}

/**
 * Tracks the active {@link Screen} and the open Report Template id in the URL
 * hash so both survive a page refresh and can be linked to directly. The
 * initial values are read from the current hash; navigating mirrors them into
 * the hash, and external hash changes (the browser back/forward buttons) flow
 * back into state.
 *
 * @returns A tuple of the active screen, a `navigate(screen, templateId?)`
 * setter, and the active Report Template id (`null` unless the builder is open).
 */
export function useHashScreen(): readonly [
  Screen,
  (screen: Screen, templateId?: string) => void,
  string | null,
] {
  const [screen, setScreen] = useState<Screen>(() => screenFromHash(window.location.hash))
  const [templateId, setTemplateId] = useState<string | null>(() =>
    templateIdFromHash(window.location.hash),
  )

  useEffect(() => {
    // Subscribe to hash changes the app didn't initiate — chiefly the browser
    // back/forward buttons. The initial values are already set from the hash by
    // the lazy state initializers above.
    const sync = () => {
      setScreen(screenFromHash(window.location.hash))
      setTemplateId(templateIdFromHash(window.location.hash))
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const navigate = useCallback((next: Screen, nextTemplateId?: string) => {
    // Switch immediately for a snappy transition, then mirror the screen (and
    // any template id) into the URL so a refresh or shared link lands on it. The
    // resulting `hashchange` re-runs `sync`, a no-op since state already matches.
    setScreen(next)
    setTemplateId(nextTemplateId ?? null)
    const targetHash = hashFromScreen(next, nextTemplateId)
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
  }, [])

  return [screen, navigate, templateId]
}
