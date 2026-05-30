using System.Text.Json.Serialization;
using RecordKeeping.Infrastructure.Identity;

namespace RecordKeeping.Api;

/// <summary>
/// Maps the OAuth 2.0 Dynamic Client Registration endpoint (RFC 7591). This is part of the
/// authorization-server surface rather than MCP itself, but exists primarily so MCP agents
/// (Claude, ChatGPT, Copilot) can self-register without manual configuration. Registration is
/// anonymous and hardened in <see cref="DynamicClientRegistration"/>.
/// </summary>
public static class DynamicClientRegistrationEndpoint
{
    /// <summary>
    /// Maps <c>POST /connect/register</c>, returning <c>201 Created</c> with the issued client
    /// metadata on success or <c>400 Bad Request</c> with an RFC 7591 error on rejection.
    /// </summary>
    /// <param name="app">The web application to map the endpoint on.</param>
    /// <returns>The same <paramref name="app"/> instance, for chaining.</returns>
    public static WebApplication MapDynamicClientRegistration(this WebApplication app)
    {
        app.MapPost(DynamicClientRegistration.EndpointPath, async (
            ClientRegistrationRequestBody body,
            DynamicClientRegistration registration,
            CancellationToken cancellationToken) =>
        {
            var request = new DynamicClientRegistrationRequest(
                body.RedirectUris ?? [],
                body.ClientName,
                body.Scope);

            var result = await registration.RegisterAsync(request, cancellationToken);

            if (!result.Succeeded)
            {
                return Results.Json(
                    new RegistrationErrorResponse(result.Error!, result.ErrorDescription),
                    statusCode: StatusCodes.Status400BadRequest);
            }

            var response = new ClientRegistrationResponseBody(
                result.ClientId!,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                [.. result.RedirectUris],
                TokenEndpointAuthMethod: "none",
                GrantTypes: ["authorization_code", "refresh_token"],
                ResponseTypes: ["code"],
                result.Scope);

            return Results.Json(response, statusCode: StatusCodes.Status201Created);
        })
        .AllowAnonymous()
        .WithName("DynamicClientRegistration");

        return app;
    }
}

/// <summary>The RFC 7591 client-registration request fields RecordKeeping reads.</summary>
internal sealed record ClientRegistrationRequestBody
{
    [JsonPropertyName("redirect_uris")] public string[]? RedirectUris { get; init; }

    [JsonPropertyName("client_name")] public string? ClientName { get; init; }

    [JsonPropertyName("scope")] public string? Scope { get; init; }
}

/// <summary>The RFC 7591 client-registration success response.</summary>
internal sealed record ClientRegistrationResponseBody(
    [property: JsonPropertyName("client_id")] string ClientId,
    [property: JsonPropertyName("client_id_issued_at")] long ClientIdIssuedAt,
    [property: JsonPropertyName("redirect_uris")] string[] RedirectUris,
    [property: JsonPropertyName("token_endpoint_auth_method")] string TokenEndpointAuthMethod,
    [property: JsonPropertyName("grant_types")] string[] GrantTypes,
    [property: JsonPropertyName("response_types")] string[] ResponseTypes,
    [property: JsonPropertyName("scope")] string? Scope);

/// <summary>The RFC 7591 client-registration error response.</summary>
internal sealed record RegistrationErrorResponse(
    [property: JsonPropertyName("error")] string Error,
    [property: JsonPropertyName("error_description")] string? ErrorDescription);
