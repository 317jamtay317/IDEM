using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Infrastructure.Tests.Identity;

/// <summary>
/// Unit tests for the redirect-URI hardening applied to dynamically-registered MCP clients.
/// OAuth 2.1 permits only HTTPS or loopback redirect URIs for public clients.
/// </summary>
public class DynamicClientRegistrationTests
{
    [Theory]
    [InlineData("https://claude.ai/api/mcp/auth_callback")]
    [InlineData("https://chatgpt.com/connector_platform_oauth_redirect")]
    [InlineData("http://localhost:33418/callback")]
    [InlineData("http://127.0.0.1:8080/oauth/callback")]
    public void IsAllowedRedirectUri_AcceptsHttpsAndLoopback(string uri) =>
        DynamicClientRegistration.IsAllowedRedirectUri(uri).ShouldBeTrue();

    [Theory]
    [InlineData("http://evil.example.com/callback")] // plaintext, non-loopback
    [InlineData("ftp://localhost/callback")]          // wrong scheme
    [InlineData("not-a-uri")]                          // unparseable
    [InlineData("")]                                   // empty
    [InlineData(null)]                                 // missing
    public void IsAllowedRedirectUri_RejectsEverythingElse(string? uri) =>
        DynamicClientRegistration.IsAllowedRedirectUri(uri).ShouldBeFalse();
}
