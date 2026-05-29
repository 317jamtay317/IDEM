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
      <main>
        <h1>RecordKeeping</h1>
        <p>Loading…</p>
      </main>
    )
  }

  if (auth.error) {
    return (
      <main>
        <h1>RecordKeeping</h1>
        <p>Auth error: {auth.error.message}</p>
      </main>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <main>
        <h1>RecordKeeping</h1>
        <p>Sign in to continue.</p>
        <button type="button" onClick={() => auth.signinRedirect()}>
          Sign in
        </button>
      </main>
    )
  }

  return (
    <main>
      <h1>RecordKeeping</h1>
      {meError && <p>Error fetching /api/me: {meError}</p>}
      {me && (
        <>
          <p>
            Signed in as <strong>{me.email}</strong>
            {me.isSiteAdmin && <span> &middot; SiteAdmin</span>}
          </p>
          <button type="button" onClick={() => auth.signoutRedirect()}>
            Sign out
          </button>
        </>
      )}
      {!me && !meError && <p>Loading user info…</p>}
    </main>
  )
}

export default App
