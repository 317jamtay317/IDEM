using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

/// <summary>
/// Guards the seeded SPA OIDC client's registered redirect URIs. The SPA derives its
/// <c>redirect_uri</c> from <c>window.location.origin + "/callback"</c>, so every origin the
/// app can be served from (docker-compose HTTPS, dotnet run, Vite) must be registered or
/// OpenIddict rejects the login with ID2043 (invalid redirect_uri).
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class SpaClientSeedTests(RecordKeepingApiFactory factory)
{
    [Theory]
    [InlineData("https://localhost:8443/callback")] // docker-compose: api (HTTPS)
    [InlineData("https://localhost:8444/callback")] // docker-compose: mcp (HTTPS)
    [InlineData("https://localhost/callback")]       // canonical
    public async Task SpaClient_RegistersRedirectUri(string redirectUri)
    {
        using var scope = factory.Services.CreateScope();
        var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();

        var spa = await manager.FindByClientIdAsync(AuthSeeder.SpaClientId);
        spa.ShouldNotBeNull();
        var registered = await manager.GetRedirectUrisAsync(spa!);

        registered.ShouldContain(redirectUri);
    }
}
