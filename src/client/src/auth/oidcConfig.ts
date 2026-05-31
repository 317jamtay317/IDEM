import { WebStorageStateStore } from 'oidc-client-ts';
import type { UserManagerSettings } from 'oidc-client-ts';

/**
 * OIDC client configuration. Authority + redirect URIs derive from the current
 * origin so the SPA works under any of the locally-seeded RecordKeeping URIs
 * (dotnet run http/https, docker-compose, Vite dev) without rebuilds.
 *
 * The matching server-side client registration lives in
 * `RecordKeeping.Infrastructure.Identity.AuthSeeder.SpaClientId` (`spa`).
 */
export const oidcConfig: UserManagerSettings = {
  authority: window.location.origin,
  client_id: 'spa',
  redirect_uri: window.location.origin + '/callback',
  post_logout_redirect_uri: window.location.origin + '/',
  response_type: 'code',
  scope: 'openid profile email offline_access',

  // Persist tokens through reloads but not browser restarts.
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),

  // Refresh tokens silently via hidden iframe before they expire.
  automaticSilentRenew: true,
};

/**
 * After a successful callback, return to the site root, dropping the `/callback`
 * path along with its `?code=` and `&state=` query. Without this the app would
 * stay on `/callback`, and every in-app hash route would hang off it
 * (e.g. `/callback#/reports`). Passed as a separate prop on <AuthProvider/>
 * since react-oidc-context owns it, not the underlying UserManagerSettings.
 */
export const onSigninCallback = (): void => {
  window.history.replaceState({}, document.title, '/');
};
