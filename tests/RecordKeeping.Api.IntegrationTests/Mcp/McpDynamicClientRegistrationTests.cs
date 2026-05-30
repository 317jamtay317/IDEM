using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace RecordKeeping.Api.IntegrationTests.Mcp;

/// <summary>
/// Proves Dynamic Client Registration (RFC 7591) lets an agent self-register, and that every
/// registered client is hardened (public, PKCE-required, auth-code/refresh only, safe redirects).
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class McpDynamicClientRegistrationTests(RecordKeepingApiFactory factory)
{
    [Fact]
    public async Task Register_WithValidMetadata_Returns201AndPublicClient()
    {
        var client = factory.CreateClient();

        var response = await McpFlow.RegisterClientAsync(client, McpFlow.MinimalRegistration());

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var registered = (await response.Content.ReadFromJsonAsync<ClientRegistrationResponse>())!;
        registered.ClientId.ShouldNotBeNullOrWhiteSpace();
        registered.TokenEndpointAuthMethod.ShouldBe("none"); // public client, no secret
        registered.GrantTypes.ShouldContain("authorization_code");
        registered.GrantTypes.ShouldContain("refresh_token");
        registered.ResponseTypes.ShouldContain("code");
        registered.Scope.ShouldNotBeNull();
        registered.Scope!.ShouldContain(AuthSeeder.McpScopeName);
    }

    [Fact]
    public async Task Register_CreatesAHardenedClientInTheStore()
    {
        var client = factory.CreateClient();
        var registered = (await (await McpFlow.RegisterClientAsync(client, McpFlow.MinimalRegistration()))
            .Content.ReadFromJsonAsync<ClientRegistrationResponse>())!;

        using var scope = factory.Services.CreateScope();
        var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();
        var app = await manager.FindByClientIdAsync(registered.ClientId);
        app.ShouldNotBeNull();

        (await manager.GetClientTypeAsync(app!)).ShouldBe(ClientTypes.Public);
        (await manager.HasRequirementAsync(app!, Requirements.Features.ProofKeyForCodeExchange))
            .ShouldBeTrue();
        (await manager.HasPermissionAsync(app!, Permissions.GrantTypes.AuthorizationCode))
            .ShouldBeTrue();
        (await manager.HasPermissionAsync(app!, Permissions.GrantTypes.ClientCredentials))
            .ShouldBeFalse(); // hardening: no machine-to-machine grant
    }

    [Theory]
    [InlineData("http://evil.example.com/callback")] // plaintext, non-loopback
    [InlineData("ftp://localhost/callback")]          // wrong scheme
    public async Task Register_WithDisallowedRedirectUri_Returns400(string redirectUri)
    {
        var client = factory.CreateClient();

        var response = await McpFlow.RegisterClientAsync(
            client, McpFlow.MinimalRegistration(redirectUri: redirectUri));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<RegistrationError>();
        error!.Error.ShouldBe("invalid_redirect_uri");
    }

    [Fact]
    public async Task Register_WithNoRedirectUris_Returns400()
    {
        var client = factory.CreateClient();

        var response = await McpFlow.RegisterClientAsync(client, new
        {
            client_name = "Missing Redirects",
            scope = McpFlow.McpScope,
        });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}

/// <summary>Typed view of an RFC 7591 registration error response.</summary>
internal sealed record RegistrationError(
    [property: System.Text.Json.Serialization.JsonPropertyName("error")] string Error,
    [property: System.Text.Json.Serialization.JsonPropertyName("error_description")] string? ErrorDescription);
