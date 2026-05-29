using System.Net;
using System.Net.Http.Json;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

[Collection(nameof(IntegrationTestCollection))]
public class TokenEndpointTests(RecordKeepingApiFactory factory)
{
    [Fact]
    public async Task Token_WithValidAuthorizationCode_ReturnsAccessAndRefreshTokens()
    {
        var client = AuthFlow.CreateClient(factory);
        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(client);

        var response = await AuthFlow.ExchangeCodeForTokensAsync(client, code);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var tokens = await response.Content.ReadFromJsonAsync<TokenResponse>();
        tokens.ShouldNotBeNull();
        tokens!.AccessToken.ShouldNotBeNullOrWhiteSpace();
        tokens.RefreshToken.ShouldNotBeNullOrWhiteSpace();
        tokens.TokenType.ShouldBe("Bearer");
        tokens.ExpiresIn.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task Token_WithInvalidCode_ReturnsBadRequest()
    {
        var client = AuthFlow.CreateClient(factory);

        var response = await AuthFlow.ExchangeCodeForTokensAsync(client, "totally-bogus-code");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait("Invariant", "I-D15")]
    public async Task Token_WithRefreshToken_RotatesAndReturnsNewAccessToken()
    {
        var client = AuthFlow.CreateClient(factory);
        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(client);
        var firstResponse = await AuthFlow.ExchangeCodeForTokensAsync(client, code);
        firstResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        var firstTokens = (await firstResponse.Content.ReadFromJsonAsync<TokenResponse>())!;
        firstTokens.RefreshToken.ShouldNotBeNullOrWhiteSpace();

        var refreshResponse = await AuthFlow.RefreshTokensAsync(client, firstTokens.RefreshToken!);

        refreshResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
        var refreshed = (await refreshResponse.Content.ReadFromJsonAsync<TokenResponse>())!;
        refreshed.AccessToken.ShouldNotBeNullOrWhiteSpace();
        refreshed.AccessToken.ShouldNotBe(firstTokens.AccessToken);
        refreshed.RefreshToken.ShouldNotBeNullOrWhiteSpace();
        refreshed.RefreshToken.ShouldNotBe(firstTokens.RefreshToken); // rotation
    }
}
