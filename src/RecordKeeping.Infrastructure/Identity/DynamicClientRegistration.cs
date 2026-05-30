using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace RecordKeeping.Infrastructure.Identity;

/// <summary>
/// Implements OAuth 2.0 Dynamic Client Registration (RFC 7591) for MCP clients.
/// AI agents (Claude, ChatGPT, Copilot) call this on first connection to obtain an
/// OAuth <c>client_id</c> without manual configuration.
/// </summary>
/// <remarks>
/// OpenIddict has no built-in registration endpoint, so registration is implemented here
/// against <see cref="IOpenIddictApplicationManager"/>. Every client created here is
/// hardened: public (no secret), PKCE-required, and limited to the authorization-code and
/// refresh-token flows with strictly validated redirect URIs.
/// </remarks>
public sealed class DynamicClientRegistration(IOpenIddictApplicationManager applicationManager)
{
    /// <summary>The path the MCP/OAuth discovery document advertises as <c>registration_endpoint</c>.</summary>
    public const string EndpointPath = "/connect/register";

    /// <summary>The RFC 7591 error code returned when a redirect URI is missing or disallowed.</summary>
    public const string InvalidRedirectUriError = "invalid_redirect_uri";

    /// <summary>
    /// The scopes granted to every dynamically-registered MCP client. Fixed (rather than echoing
    /// the request) because these are the only scopes RecordKeeping supports and granting the full
    /// set keeps agent onboarding friction-free. <c>openid</c> is always permitted by OpenIddict.
    /// </summary>
    public const string GrantedScope = "openid profile email offline_access " + AuthSeeder.McpScopeName;

    /// <summary>
    /// Determines whether a redirect URI is permitted for a dynamically-registered client.
    /// Per OAuth 2.1, only absolute HTTPS URIs or loopback (localhost) URIs are allowed.
    /// </summary>
    /// <param name="uri">The candidate redirect URI.</param>
    /// <returns><see langword="true"/> if the URI may be registered; otherwise <see langword="false"/>.</returns>
    public static bool IsAllowedRedirectUri(string? uri)
    {
        if (string.IsNullOrWhiteSpace(uri) || !Uri.TryCreate(uri, UriKind.Absolute, out var parsed))
        {
            return false;
        }

        // HTTPS is always allowed; plaintext HTTP only for loopback (local development callbacks).
        return parsed.Scheme == Uri.UriSchemeHttps
            || (parsed.Scheme == Uri.UriSchemeHttp && parsed.IsLoopback);
    }

    /// <summary>
    /// Registers a new public MCP client from an RFC 7591 request.
    /// </summary>
    /// <param name="request">The parsed registration request.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// A successful <see cref="DynamicClientRegistrationResult"/> describing the created client,
    /// or a failure result carrying the RFC 7591 error code when the request is rejected.
    /// </returns>
    public async Task<DynamicClientRegistrationResult> RegisterAsync(
        DynamicClientRegistrationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.RedirectUris is null || request.RedirectUris.Count == 0)
        {
            return DynamicClientRegistrationResult.Failure(
                InvalidRedirectUriError, "At least one redirect_uri is required.");
        }

        foreach (var uri in request.RedirectUris)
        {
            if (!IsAllowedRedirectUri(uri))
            {
                return DynamicClientRegistrationResult.Failure(
                    InvalidRedirectUriError,
                    $"Redirect URI '{uri}' is not allowed; only HTTPS or loopback URIs may be registered.");
            }
        }

        var clientId = Guid.NewGuid().ToString("N");
        var descriptor = BuildHardenedDescriptor(clientId, request);

        foreach (var uri in request.RedirectUris)
        {
            descriptor.RedirectUris.Add(new Uri(uri));
        }

        await applicationManager.CreateAsync(descriptor, cancellationToken);

        return DynamicClientRegistrationResult.Success(clientId, request.RedirectUris, GrantedScope);
    }

    // Builds a public, PKCE-required client limited to the authorization-code + refresh-token flows.
    private static OpenIddictApplicationDescriptor BuildHardenedDescriptor(
        string clientId, DynamicClientRegistrationRequest request) => new()
        {
            ClientId = clientId,
            ClientType = ClientTypes.Public,
            ConsentType = ConsentTypes.Implicit,
            DisplayName = string.IsNullOrWhiteSpace(request.ClientName) ? "MCP Client" : request.ClientName,
            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Email,
                Permissions.Scopes.Profile,
                Permissions.Prefixes.Scope + Scopes.OfflineAccess,
                Permissions.Prefixes.Scope + AuthSeeder.McpScopeName,
            },
            Requirements =
            {
                Requirements.Features.ProofKeyForCodeExchange,
            },
        };
}
