using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using ModelContextProtocol.Client;
using RecordKeeping.Api.IntegrationTests.Auth;
using RecordKeeping.Infrastructure.Identity;

namespace RecordKeeping.Api.IntegrationTests.Mcp;

/// <summary>
/// Test-only helpers for exercising the MCP surface: Dynamic Client Registration,
/// and connecting the real MCP client SDK to the in-memory server over the
/// Streamable HTTP transport with a bearer access token.
/// </summary>
internal static class McpFlow
{
    /// <summary>The canonical MCP endpoint path mounted on the API.</summary>
    public const string McpEndpoint = "/mcp";

    /// <summary>A registered HTTPS redirect URI used by the test agent.</summary>
    public const string DefaultRedirectUri = "https://localhost/callback";

    /// <summary>The scope set an MCP agent requests (standard OIDC scopes plus <c>mcp</c>).</summary>
    public const string McpScope = "openid profile email offline_access " + AuthSeeder.McpScopeName;

    /// <summary>
    /// The RFC 8707 resource indicator an MCP client sends (the canonical MCP server URL). The
    /// in-memory test server is reached at <c>http://localhost</c>, so the MCP resource is its
    /// <c>/mcp</c> endpoint. Real agents send their own host; the server accepts any.
    /// </summary>
    public const string McpResource = "http://localhost" + McpEndpoint;

    /// <summary>Builds a minimal, well-formed RFC 7591 registration request body.</summary>
    public static object MinimalRegistration(
        string redirectUri = DefaultRedirectUri,
        string clientName = "Integration Test Agent") => new
        {
            redirect_uris = new[] { redirectUri },
            client_name = clientName,
            scope = McpScope,
            grant_types = new[] { "authorization_code", "refresh_token" },
            response_types = new[] { "code" },
            token_endpoint_auth_method = "none",
        };

    /// <summary>POSTs a Dynamic Client Registration request to the registration endpoint.</summary>
    public static Task<HttpResponseMessage> RegisterClientAsync(HttpClient client, object request) =>
        client.PostAsJsonAsync(DynamicClientRegistration.EndpointPath, request);

    /// <summary>
    /// Performs the complete agent onboarding: DCR, interactive login + authorize with PKCE,
    /// and code exchange. Returns the MCP-scoped access token.
    /// </summary>
    public static async Task<string> OnboardAgentAndGetAccessTokenAsync(WebApplicationFactory<Program> factory)
    {
        var http = AuthFlow.CreateClient(factory);

        var registration = await RegisterClientAsync(http, MinimalRegistration());
        registration.EnsureSuccessStatusCode();
        var registered = (await registration.Content.ReadFromJsonAsync<ClientRegistrationResponse>())!;

        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(
            http, registered.ClientId, DefaultRedirectUri, McpScope, resource: McpResource);
        var tokenResponse = await AuthFlow.ExchangeCodeForTokensAsync(
            http, code, registered.ClientId, DefaultRedirectUri, McpResource);
        tokenResponse.EnsureSuccessStatusCode();
        var tokens = (await tokenResponse.Content.ReadFromJsonAsync<TokenResponse>())!;
        return tokens.AccessToken;
    }

    /// <summary>
    /// Connects the MCP client SDK to the in-memory test server, authenticating with the
    /// supplied bearer token. The transport routes through the <see cref="WebApplicationFactory{T}"/>
    /// handler, so no real socket is opened.
    /// </summary>
    public static Task<McpClient> ConnectAsync(WebApplicationFactory<Program> factory, string accessToken)
    {
        var transport = new HttpClientTransport(
            new HttpClientTransportOptions
            {
                Endpoint = new Uri("http://localhost" + McpEndpoint),
                TransportMode = HttpTransportMode.StreamableHttp,
                Name = "Integration Test Agent",
                AdditionalHeaders = new Dictionary<string, string>
                {
                    ["Authorization"] = $"Bearer {accessToken}",
                },
            },
            factory.CreateDefaultClient(),
            loggerFactory: null,
            ownsHttpClient: true);

        return McpClient.CreateAsync(transport);
    }
}

/// <summary>Typed view of the RFC 7591 client registration response.</summary>
internal sealed record ClientRegistrationResponse(
    [property: JsonPropertyName("client_id")] string ClientId,
    [property: JsonPropertyName("redirect_uris")] string[] RedirectUris,
    [property: JsonPropertyName("grant_types")] string[] GrantTypes,
    [property: JsonPropertyName("response_types")] string[] ResponseTypes,
    [property: JsonPropertyName("token_endpoint_auth_method")] string TokenEndpointAuthMethod,
    [property: JsonPropertyName("scope")] string? Scope);
