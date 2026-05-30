import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from 'react-oidc-context'
import { AppShell } from './app/AppShell'
import './App.css'

interface MeResponse {
  name: string | null
  email: string | null
  isSiteAdmin: boolean
}

/** Centred card layout used for every pre-authentication state (login, loading, error). */
function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden="true">
            RK
          </span>
          <span className="auth-brand-name">RecordKeeping</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function App() {
  const auth = useAuth()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [meError, setMeError] = useState<string | null>(null)

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user) {
      setMe(null)
      return
    }

    let cancelled = false
    fetch('/api/me', {
      headers: { Authorization: `Bearer ${auth.user.access_token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`/api/me returned ${r.status}`)
        return r.json() as Promise<MeResponse>
      })
      .then((data) => {
        if (!cancelled) setMe(data)
      })
      .catch((e) => {
        if (!cancelled) setMeError(String(e))
      })

    return () => {
      cancelled = true
    }
  }, [auth.isAuthenticated, auth.user])

  if (auth.isLoading) {
    return (
      <AuthScreen>
        <p className="auth-muted">Loading…</p>
      </AuthScreen>
    )
  }

  if (auth.error) {
    return (
      <AuthScreen>
        <h1 className="auth-title">Authentication error</h1>
        <div className="auth-alert">{auth.error.message}</div>
      </AuthScreen>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to manage compliance records.</p>
        <button type="button" className="auth-button" onClick={() => auth.signinRedirect()}>
          Sign in
        </button>
      </AuthScreen>
    )
  }

  if (meError) {
    return (
      <AuthScreen>
        <h1 className="auth-title">Something went wrong</h1>
        <div className="auth-alert">Error fetching /api/me: {meError}</div>
        <button
          type="button"
          className="auth-button auth-button-secondary"
          onClick={() => auth.signoutRedirect()}
        >
          Sign out
        </button>
      </AuthScreen>
    )
  }

  if (!me) {
    return (
      <AuthScreen>
        <p className="auth-muted">Loading user info…</p>
      </AuthScreen>
    )
  }

  return (
    <AppShell
      email={me.email}
      isSiteAdmin={me.isSiteAdmin}
      onSignOut={() => auth.signoutRedirect()}
    />
  )
}

export default App
