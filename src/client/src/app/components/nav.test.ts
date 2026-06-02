import { describe, it, expect } from 'vitest'
import { NAV_ENTRIES, visibleNavEntries } from './nav'

/**
 * Navigation is role-filtered (I-D13): SiteAdmins are platform operators who
 * work only with Organizations and Reports, while Org Users get the day-to-day
 * app. The "More" destination has been removed entirely — account actions now
 * live in the account menu off the sidebar facility / top-bar avatar.
 */
describe('visibleNavEntries', () => {
  it('shows an Org User the day-to-day destinations and never Organizations', () => {
    const tabs = visibleNavEntries(false).map((entry) => entry.tab)

    expect(tabs).toEqual(['home', 'records', 'facilities', 'reports'])
  })

  it('shows a SiteAdmin only Organizations and Reports', () => {
    const tabs = visibleNavEntries(true).map((entry) => entry.tab)

    expect(tabs).toEqual(['orgs', 'reports'])
  })
})

describe('NAV_ENTRIES', () => {
  it('no longer carries a "More" destination for any role', () => {
    const tabs = NAV_ENTRIES.map((entry) => entry.tab)

    expect(tabs as string[]).not.toContain('more')
  })
})
