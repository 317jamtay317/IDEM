using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RecordKeeping.Api.IntegrationTests.Auth;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Mcp;

/// <summary>
/// Proves the MCP endpoint is protected: anonymous calls are challenged with a discovery
/// pointer, and authenticated callers still need the <c>mcp</c> scope.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class McpUnauthenticatedTests(RecordKeepingApiFactory factory)
{
    private static readonly object InitializeRequest = new
    {
        jsonrpc = "2.0",
        id = 1,
        method = "initialize",
        @params = new
        {
            protocolVersion = "2025-06-18",
            capabilities = new { },
            clientInfo = new { name = "test", version = "1.0" },
        },
    };

    [Fact]
    public async Task Mcp_WithoutToken_Returns401WithResourceMetadataChallenge()
    {
        var client = factory.CreateClient();

        var response = await PostInitializeAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        // RFC 9728 §5.1: the challenge must point the agent at the resource metadata document.
        var challenge = response.Headers.WwwAuthenticate.ToString();
        challenge.ShouldContain("resource_metadata");
    }

    [Fact]
    [Trait("Invariant", "I-D16")]
    public async Task Mcp_WithTokenLackingMcpScope_Returns403()
    {
        // The seeded SPA client cannot request the mcp scope, so its tokens are scope-deficient.
        var client = AuthFlow.CreateClient(factory);
        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(client);
        var tokens = (await (await AuthFlow.ExchangeCodeForTokensAsync(client, code))
            .Content.ReadFromJsonAsync<TokenResponse>())!;

        var authed = factory.CreateClient();
        authed.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        var response = await PostInitializeAsync(authed);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private static Task<HttpResponseMessage> PostInitializeAsync(HttpClient client)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, McpFlow.McpEndpoint)
        {
            Content = JsonContent.Create(InitializeRequest),
        };
        request.Headers.Accept.ParseAdd("application/json");
        request.Headers.Accept.ParseAdd("text/event-stream");
        return client.SendAsync(request);
    }
}
