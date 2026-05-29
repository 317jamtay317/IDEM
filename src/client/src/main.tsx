import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { oidcConfig, onSigninCallback } from './auth/oidcConfig'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
      <App />
    </AuthProvider>
  </StrictMode>,
)
