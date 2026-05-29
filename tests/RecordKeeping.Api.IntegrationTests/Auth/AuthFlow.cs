using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using Microsoft.AspNetCore.Mvc.Testing;
using RecordKeeping.Infrastructure.Identity;

namespace RecordKeeping.Api.IntegrationTests.Auth;

/// <summary>
/// Test-only helpers for driving the OAuth Authorization Code + PKCE flow
/// against the API. Uses a static PKCE verifier so any test can reuse the
/// same challenge without coordinating state.
/// </summary>
internal static class AuthFlow
{
    /// <summary>Static code verifier (RFC 7636: 43-128 chars from [A-Z][a-z][0-9]-._~).</summary>
    public const string CodeVerifier =
        "TestVerifier_ThisIsAStaticPkceVerifierForIntegrationTestsOnly";

    /// <summary>SHA-256(verifier), base64url-encoded.</summary>
    public static string CodeChallenge { get; } = Base64UrlEncode(
        SHA256.HashData(Encoding.UTF8.GetBytes(CodeVerifier)));

    /// <summary>Creates a no-auto-redirect client suitable for stepping through 302s.</summary>
    public static HttpClient CreateClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });

    /// <summary>Builds a well-formed /connect/authorize URL for the seeded SPA client.</summary>
    public static string AuthorizationUrl(string? state = null)
    {
        var query = HttpUtility.ParseQueryString(string.Empty);
        query["client_id"] = AuthSeeder.SpaClientId;
        query["redirect_uri"] = AuthSeeder.SpaRedirectUri;
        query["response_type"] = "code";
        query["code_challenge"] = CodeChallenge;
        query["code_challenge_method"] = "S256";
        query["scope"] = "openid profile email offline_access";
        if (state is not null)
        {
            query["state"] = state;
        }
        return "/connect/authorize?" + query;
    }

    /// <summary>
    /// Drives the full login + authorize flow and returns the issued auth code.
    /// Mutates the client's cookie jar with the Identity session cookie.
    /// </summary>
    public static async Task<string> LoginAndGetAuthorizationCodeAsync(
        HttpClient client,
        string email = AuthSeeder.BootstrapSiteAdminEmail,
        string password = AuthSeeder.BootstrapSiteAdminPassword)
    {
        // Step 1: /connect/authorize -> 302 to /Account/Login?ReturnUrl=...
        var step1 = await client.GetAsync(AuthorizationUrl());
        EnsureRedirect(step1, "/connect/authorize step");
        var loginUrl = step1.Headers.Location!.OriginalString;
        var returnUrl = HttpUtility.ParseQueryString(step1.Headers.Location!.Query)["ReturnUrl"]
            ?? string.Empty;

        // Step 2: GET the login page (sets AF cookie, exposes AF token).
        var step2 = await client.GetAsync(loginUrl);
        if (step2.StatusCode != HttpStatusCode.OK)
        {
            throw new InvalidOperationException(
                $"GET {loginUrl} returned {step2.StatusCode}; expected 200.");
        }
        var html = await step2.Content.ReadAsStringAsync();
        var afToken = ExtractAntiforgeryToken(html);

        // Step 3: POST credentials -> 302 to ReturnUrl (which is /connect/authorize?...).
        var post = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("Email", email),
            new KeyValuePair<string, string>("Password", password),
            new KeyValuePair<string, string>("ReturnUrl", returnUrl),
            new KeyValuePair<string, string>("__RequestVerificationToken", afToken),
        });
        var step3 = await client.PostAsync(loginUrl, post);
        if (step3.StatusCode != HttpStatusCode.Redirect)
        {
            var body = await step3.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"POST {loginUrl} returned {step3.StatusCode}: {Truncate(body, 600)}");
        }
        var afterLoginUrl = step3.Headers.Location!.OriginalString;

        // Step 4: Follow back to /connect/authorize (now authenticated) -> 302 to redirect_uri?code=...
        var step4 = await client.GetAsync(afterLoginUrl);
        EnsureRedirect(step4, "post-login /connect/authorize step");
        var callback = step4.Headers.Location!;
        var code = HttpUtility.ParseQueryString(callback.Query)["code"];
        return code ?? throw new InvalidOperationException(
            $"No 'code' parameter in callback URL: {callback}");
    }

    /// <summary>POSTs to /connect/token to exchange an authorization code for tokens.</summary>
    public static Task<HttpResponseMessage> ExchangeCodeForTokensAsync(
        HttpClient client, string code) =>
        client.PostAsync("/connect/token", new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "authorization_code"),
            new KeyValuePair<string, string>("code", code),
            new KeyValuePair<string, string>("redirect_uri", AuthSeeder.SpaRedirectUri),
            new KeyValuePair<string, string>("client_id", AuthSeeder.SpaClientId),
            new KeyValuePair<string, string>("code_verifier", CodeVerifier),
        }));

    /// <summary>POSTs to /connect/token to exchange a refresh token for new tokens.</summary>
    public static Task<HttpResponseMessage> RefreshTokensAsync(
        HttpClient client, string refreshToken) =>
        client.PostAsync("/connect/token", new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "refresh_token"),
            new KeyValuePair<string, string>("refresh_token", refreshToken),
            new KeyValuePair<string, string>("client_id", AuthSeeder.SpaClientId),
        }));

    private static void EnsureRedirect(HttpResponseMessage response, string step)
    {
        if (response.StatusCode != HttpStatusCode.Redirect)
        {
            throw new InvalidOperationException(
                $"Expected 302 from {step}, got {response.StatusCode}.");
        }
    }

    private static string ExtractAntiforgeryToken(string html)
    {
        var match = Regex.Match(html,
            @"name=""__RequestVerificationToken""[^>]*value=""([^""]+)""");
        if (!match.Success)
        {
            throw new InvalidOperationException(
                "Could not find __RequestVerificationToken in login page HTML.");
        }
        return match.Groups[1].Value;
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Truncate(string s, int n) =>
        s.Length <= n ? s : s[..n] + "...";
}

/// <summary>Typed view of the OAuth 2.0 token response from /connect/token.</summary>
internal sealed record TokenResponse(
    [property: System.Text.Json.Serialization.JsonPropertyName("access_token")] string AccessToken,
    [property: System.Text.Json.Serialization.JsonPropertyName("refresh_token")] string? RefreshToken,
    [property: System.Text.Json.Serialization.JsonPropertyName("token_type")] string TokenType,
    [property: System.Text.Json.Serialization.JsonPropertyName("expires_in")] int ExpiresIn);
