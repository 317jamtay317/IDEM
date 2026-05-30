using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Mcp;

/// <summary>
/// Proves the MCP server publishes RFC 9728 Protected Resource Metadata so AI agents can
/// discover the authorization server with no manual configuration.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class McpProtectedResourceMetadataTests(RecordKeepingApiFactory factory)
{
    [Fact]
    public async Task ProtectedResourceMetadata_IsPublished_ForTheMcpResource()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/.well-known/oauth-protected-resource/mcp");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var metadata = await response.Content.ReadFromJsonAsync<ProtectedResourceMetadataDocument>();
        metadata.ShouldNotBeNull();
        metadata!.Resource.ShouldNotBeNullOrWhiteSpace();
        metadata.Resource!.ShouldEndWith("/mcp");
        metadata.AuthorizationServers.ShouldNotBeNull();
        metadata.AuthorizationServers!.ShouldNotBeEmpty();
        metadata.ScopesSupported.ShouldContain(AuthSeeder.McpScopeName);
    }

    [Fact]
    public async Task ProtectedResourceMetadata_HonorsForwardedHostAndProto()
    {
        // Behind a TLS-terminating proxy/tunnel, discovery must advertise the public host and
        // https scheme (from X-Forwarded-*) so remote agents are pointed at a reachable URL,
        // not the internal origin.
        var client = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/.well-known/oauth-protected-resource/mcp");
        request.Headers.Add("X-Forwarded-Proto", "https");
        request.Headers.Add("X-Forwarded-Host", "mcp.example.com");

        var response = await client.SendAsync(request);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var metadata = await response.Content.ReadFromJsonAsync<ProtectedResourceMetadataDocument>();
        metadata!.Resource.ShouldBe("https://mcp.example.com/mcp");
        metadata.AuthorizationServers.ShouldNotBeNull();
        metadata.AuthorizationServers!.ShouldContain("https://mcp.example.com");
    }

    [Fact]
    public async Task ProtectedResourceMetadata_AuthorizationServer_ServesOAuthMetadata()
    {
        // The advertised authorization server must itself expose RFC 8414 metadata (OpenIddict).
        var client = factory.CreateClient();
        var prm = await (await client.GetAsync("/.well-known/oauth-protected-resource/mcp"))
            .Content.ReadFromJsonAsync<ProtectedResourceMetadataDocument>();
        var authServer = prm!.AuthorizationServers!.First().TrimEnd('/');

        var metadata = await client.GetAsync($"{authServer}/.well-known/oauth-authorization-server");

        metadata.StatusCode.ShouldBe(HttpStatusCode.OK);
        var doc = await metadata.Content.ReadFromJsonAsync<AuthorizationServerMetadataDocument>();
        doc.ShouldNotBeNull();
        doc!.AuthorizationEndpoint.ShouldNotBeNullOrWhiteSpace();
        doc.TokenEndpoint.ShouldNotBeNullOrWhiteSpace();
        // Dynamic Client Registration must be advertised so agents can self-register.
        doc.RegistrationEndpoint.ShouldNotBeNullOrWhiteSpace();
        doc.RegistrationEndpoint!.ShouldEndWith(DynamicClientRegistration.EndpointPath);
    }
}

/// <summary>Typed view of an RFC 9728 Protected Resource Metadata document.</summary>
internal sealed record ProtectedResourceMetadataDocument(
    [property: JsonPropertyName("resource")] string? Resource,
    [property: JsonPropertyName("authorization_servers")] string[]? AuthorizationServers,
    [property: JsonPropertyName("scopes_supported")] string[] ScopesSupported);

/// <summary>Typed view of the subset of RFC 8414 Authorization Server Metadata we assert on.</summary>
internal sealed record AuthorizationServerMetadataDocument(
    [property: JsonPropertyName("authorization_endpoint")] string? AuthorizationEndpoint,
    [property: JsonPropertyName("token_endpoint")] string? TokenEndpoint,
    [property: JsonPropertyName("registration_endpoint")] string? RegistrationEndpoint);
