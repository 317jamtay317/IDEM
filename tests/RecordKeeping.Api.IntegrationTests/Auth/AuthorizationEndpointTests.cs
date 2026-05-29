using System.Net;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

[Collection(nameof(IntegrationTestCollection))]
public class AuthorizationEndpointTests(RecordKeepingApiFactory factory)
{
    [Fact]
    public async Task Authorize_WithUnauthenticatedRequest_RedirectsToLoginPage()
    {
        var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });

        var url =
            "/connect/authorize" +
            "?client_id=spa" +
            "&redirect_uri=" + Uri.EscapeDataString("https://localhost/callback") +
            "&response_type=code" +
            "&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" +
            "&code_challenge_method=S256" +
            "&scope=openid";

        var response = await client.GetAsync(url);

        response.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        response.Headers.Location.ShouldNotBeNull();
        response.Headers.Location!.AbsolutePath.ShouldBe("/Account/Login");
    }
}
