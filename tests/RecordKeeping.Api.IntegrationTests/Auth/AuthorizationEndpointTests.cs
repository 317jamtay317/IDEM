using System.Net;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

[Collection(nameof(IntegrationTestCollection))]
public class AuthorizationEndpointTests(RecordKeepingApiFactory factory)
{
    [Fact]
    public async Task Authorize_WithUnauthenticatedRequest_RedirectsToLoginPage()
    {
        var client = AuthFlow.CreateClient(factory);

        var response = await client.GetAsync(AuthFlow.AuthorizationUrl());

        response.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        response.Headers.Location.ShouldNotBeNull();
        response.Headers.Location!.AbsolutePath.ShouldBe("/Account/Login");
    }

    [Fact]
    public async Task Login_WithValidCredentials_RedirectsToCallbackWithCode()
    {
        var client = AuthFlow.CreateClient(factory);

        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(client);

        code.ShouldNotBeNullOrWhiteSpace();
    }
}
