using System.Net;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

public class MeEndpointTests(RecordKeepingApiFactory factory) : IClassFixture<RecordKeepingApiFactory>
{
    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/me");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
