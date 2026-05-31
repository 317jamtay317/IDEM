import { describe, it, expect, beforeEach } from 'vitest'
import { onSigninCallback } from './oidcConfig'

describe('onSigninCallback', () => {
  beforeEach(() => {
    // Reset to a clean root URL between tests.
    window.history.replaceState({}, '', '/')
  })

  it('returns to the site root, dropping the /callback path and its query', () => {
    // The identity provider redirects back to /callback with the auth code.
    window.history.replaceState({}, '', '/callback?code=abc123&state=xyz')

    onSigninCallback()

    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
    expect(window.location.href).not.toContain('callback')
  })
})
