import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import './App.css'

interface MeResponse {
  name: string | null
  email: string | null
  isSiteAdmin: boolean
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
      <div className="page">
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      </div>
    )
  }

  if (auth.error) {
    return (
      <div className="page">
        <div className="card">
          <p className="brand">RecordKeeping</p>
          <h1 className="title">Authentication error</h1>
          <div className="alert-error">{auth.error.message}</div>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="page">
        <div className="card">
          <p className="brand">RecordKeeping</p>
          <h1 className="title">Welcome back</h1>
          <p className="subtitle">Sign in to manage compliance records.</p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => auth.signinRedirect()}
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card">
        <p className="brand">RecordKeeping</p>
        <h1 className="title">Signed in</h1>
        <p className="subtitle">You're authenticated against the RecordKeeping API.</p>

        {meError && <div className="alert-error">Error fetching /api/me: {meError}</div>}

        {me && (
          <>
            <div className="user-row">
              <div className="user-meta">
                <span className="user-email">{me.email}</span>
                {me.isSiteAdmin && <span className="badge">SiteAdmin</span>}
              </div>
            </div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => auth.signoutRedirect()}
            >
              Sign out
            </button>
          </>
        )}

        {!me && !meError && <p className="muted">Loading user info…</p>}
      </div>
    </div>
  )
}

export default App
