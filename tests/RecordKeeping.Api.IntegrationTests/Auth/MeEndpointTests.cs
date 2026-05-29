using System.Net;
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
}
