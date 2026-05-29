using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

[Collection(nameof(IntegrationTestCollection))]
public class MeEndpointTests(RecordKeepingApiFactory factory)
{
    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/me");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_WithValidAccessToken_ReturnsCurrentUser()
    {
        var client = AuthFlow.CreateClient(factory);
        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(client);
        var tokenResponse = await AuthFlow.ExchangeCodeForTokensAsync(client, code);
        var tokens = (await tokenResponse.Content.ReadFromJsonAsync<TokenResponse>())!;

        // Fresh client without the Identity cookie - prove the access token alone authorizes.
        var apiClient = factory.CreateClient();
        apiClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

        var response = await apiClient.GetAsync("/api/me");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<MeResponse>();
        body.ShouldNotBeNull();
        body!.Email.ShouldBe(AuthSeeder.BootstrapSiteAdminEmail);
        body.IsSiteAdmin.ShouldBeTrue();
    }

    private sealed record MeResponse(string? Name, string? Email, bool IsSiteAdmin);
}
