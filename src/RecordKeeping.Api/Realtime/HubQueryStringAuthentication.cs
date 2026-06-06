namespace RecordKeeping.Api.Realtime;

/// <summary>
/// Lets browser WebSocket clients authenticate a SignalR hub. A browser cannot set the
/// <c>Authorization</c> header on a WebSocket handshake, so the SignalR JavaScript client sends the
/// access token in the <c>access_token</c> query string instead. This copies that token into the
/// <c>Authorization</c> header for hub requests, so the app's existing bearer-token validation
/// authenticates the connection with no special handling downstream.
/// </summary>
public static class HubQueryStringAuthentication
{
    /// <summary>
    /// If <paramref name="context"/> targets a path under <paramref name="hubPath"/>, carries an
    /// <c>access_token</c> query value, and does not already have an <c>Authorization</c> header,
    /// sets <c>Authorization: Bearer &lt;token&gt;</c>. A no-op otherwise. Run before authentication.
    /// </summary>
    /// <param name="context">The current request.</param>
    /// <param name="hubPath">The base path the hub is mapped to (e.g. <c>/hubs/report-preview</c>).</param>
    public static void ApplyAccessTokenFromQueryString(HttpContext context, PathString hubPath)
    {
        if (context.Request.Headers.ContainsKey("Authorization"))
        {
            return;
        }

        if (!context.Request.Path.StartsWithSegments(hubPath))
        {
            return;
        }

        if (context.Request.Query.TryGetValue("access_token", out var token) &&
            !string.IsNullOrEmpty(token))
        {
            context.Request.Headers.Authorization = $"Bearer {token}";
        }
    }
}
