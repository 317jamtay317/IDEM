import { useEffect, useState } from 'react'

/** Minimum viewport width (px) at which the tablet layout engages. */
const TABLET = 768
/** Minimum viewport width (px) at which the desktop (sidebar) layout engages. */
const DESKTOP = 1024

/** The active responsive layout tier. */
export interface Breakpoint {
  /** True at tablet width and above (≥ 768px). */
  isTabletUp: boolean
  /** True at desktop width and above (≥ 1024px); drives the sidebar layout. */
  isDesktop: boolean
}

function read(): Breakpoint {
  // `matchMedia` is unavailable in non-browser environments; default to mobile.
  if (typeof window === 'undefined' || !window.matchMedia) {
    return { isTabletUp: false, isDesktop: false }
  }
  return {
    isTabletUp: window.matchMedia(`(min-width: ${TABLET}px)`).matches,
    isDesktop: window.matchMedia(`(min-width: ${DESKTOP}px)`).matches,
  }
}

/**
 * Tracks the active responsive breakpoint, updating when the viewport crosses
 * the tablet (768px) or desktop (1024px) thresholds. Lets components choose a
 * distinct composition per tier where CSS reflow alone is insufficient
 * (e.g. cards vs. a data table).
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(read)

  useEffect(() => {
    const tablet = window.matchMedia(`(min-width: ${TABLET}px)`)
    const desktop = window.matchMedia(`(min-width: ${DESKTOP}px)`)
    const update = () => setBp(read())

    tablet.addEventListener('change', update)
    desktop.addEventListener('change', update)
    update()

    return () => {
      tablet.removeEventListener('change', update)
      desktop.removeEventListener('change', update)
    }
  }, [])

  return bp
}
