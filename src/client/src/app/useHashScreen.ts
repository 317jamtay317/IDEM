import { useCallback, useEffect, useState } from 'react'
import { type NavTab } from './components/nav'

/**
 * Every screen the {@link AppShell} can render: the {@link NavTab} destinations
 * plus `log` (reached from the dashboard), `report-builder` (the SiteAdmin Report
 * Builder, reached by opening a Report Template from the Reports screen), and
 * `report-preview` (the SiteAdmin live preview, opened from the builder).
 */
export type Screen = NavTab | 'log' | 'report-builder' | 'report-preview'

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
  'productionFields',
  'fieldLimits',
  'log',
  'facilities',
  'report-builder',
  'report-preview',
]

/** The screen segment that opens the Report Builder, e.g. `#/report-builder/{id}`. */
const REPORT_BUILDER: Screen = 'report-builder'

/** The screen segment that opens the live preview, e.g. `#/report-preview/{id}`. */
const REPORT_PREVIEW: Screen = 'report-preview'

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
 * Extracts the Report Template id carried by a Report Builder or live-preview hash. Both routes are
 * `#/{screen}/{templateId}` (the preview's session id *is* the template's id); the id is the second
 * path segment and is percent-decoded. Any other hash — including a bare `#/report-builder` with no
 * id — has no template id.
 *
 * @param hash The `window.location.hash` value, e.g. `#/report-builder/annual-emissions`.
 * @returns The decoded template id, or `null` when the hash names no builder/preview template.
 */
export function templateIdFromHash(hash: string): string | null {
  const segments = hash.replace(/^#\/?/, '').split('/')
  if (segments[0] !== REPORT_BUILDER && segments[0] !== REPORT_PREVIEW) return null
  const id = segments[1]
  return id ? decodeURIComponent(id) : null
}

/**
 * Parses the selected Facility id out of a `#/facilities/{id}` detail hash. Any
 * other hash — including the bare `#/facilities` list and a trailing-slash
 * `#/facilities/` — has no selected Facility.
 *
 * @param hash The `window.location.hash` value, e.g. `#/facilities/abc`.
 * @returns The Facility id the hash names, or `null` when it names none.
 */
export function facilityIdFromHash(hash: string): string | null {
  const segments = hash.replace(/^#\/?/, '').split('/')
  if (segments[0] !== 'facilities') return null
  const id = segments[1]?.trim()
  return id ? id : null
}

/**
 * The detail id carried by the current hash: a Report Template id on the builder
 * route, a Facility id on a facility-detail route, otherwise `null`. The two are
 * mutually exclusive — each belongs to a different screen — so reading whichever
 * is present yields the active screen's detail id.
 */
function detailIdFromHash(hash: string): string | null {
  return templateIdFromHash(hash) ?? facilityIdFromHash(hash)
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
  if ((screen === REPORT_BUILDER || screen === REPORT_PREVIEW) && templateId) {
    return `#/${screen}/${encodeURIComponent(templateId)}`
  }
  return `#/${screen}`
}

/**
 * Builds the location hash for a Facility's detail page.
 *
 * @param facilityId The Facility to encode.
 * @returns The hash string, e.g. `#/facilities/abc`.
 */
export function hashForFacility(facilityId: string): string {
  return `#/facilities/${facilityId}`
}

/**
 * Tracks the active {@link Screen} and the detail id carried by the URL hash, so
 * both survive a page refresh and can be linked to directly. The initial values
 * are read from the current hash; navigating mirrors them into the hash, and
 * external hash changes (the browser back/forward buttons) flow back into state.
 *
 * The detail id is whichever screen-specific id the hash carries: a Report
 * Template id on the `report-builder` route, a Facility id on a facility-detail
 * route, else `null`.
 *
 * @returns A tuple of: the active screen; a `navigate(screen, templateId?)`
 * setter (which clears any detail id, encoding a Report Template id into the
 * builder hash); the active detail id (`null` unless a detail-carrying screen is
 * open); and an `openFacility(id)` setter that opens a Facility's detail page.
 */
export function useHashScreen(): readonly [
  Screen,
  (screen: Screen, templateId?: string) => void,
  string | null,
  (facilityId: string) => void,
] {
  const [screen, setScreen] = useState<Screen>(() => screenFromHash(window.location.hash))
  const [detailId, setDetailId] = useState<string | null>(() =>
    detailIdFromHash(window.location.hash),
  )

  useEffect(() => {
    // Subscribe to hash changes the app didn't initiate — chiefly the browser
    // back/forward buttons. The initial values are already set from the hash by
    // the lazy state initializers above.
    const sync = () => {
      setScreen(screenFromHash(window.location.hash))
      setDetailId(detailIdFromHash(window.location.hash))
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const navigate = useCallback((next: Screen, nextTemplateId?: string) => {
    // Switch immediately for a snappy transition, then mirror the screen (and any
    // template id) into the URL so a refresh or shared link lands on it. Leaving a
    // detail-carrying screen (a builder template or a Facility) clears its id. The
    // resulting `hashchange` re-runs `sync`, a no-op since state already matches.
    setScreen(next)
    setDetailId(nextTemplateId ?? null)
    const targetHash = hashFromScreen(next, nextTemplateId)
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
  }, [])

  const openFacility = useCallback((id: string) => {
    setScreen('facilities')
    setDetailId(id)
    const targetHash = hashForFacility(id)
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
  }, [])

  return [screen, navigate, detailId, openFacility]
}
