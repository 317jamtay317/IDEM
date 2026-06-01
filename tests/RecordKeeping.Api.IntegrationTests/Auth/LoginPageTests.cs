using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

[Collection(nameof(IntegrationTestCollection))]
public class LoginPageTests(RecordKeepingApiFactory factory)
{
    [Theory]
    [InlineData(true)]   // checkbox checked -> persistent cookie (has expires)
    [InlineData(false)]  // checkbox unchecked -> session cookie (no expires)
    public async Task Login_RememberMe_ControlsCookiePersistence(bool rememberMe)
    {
        var client = AuthFlow.CreateClient(factory);

        var response = await PostLoginAsync(client, rememberMe);
        response.StatusCode.ShouldBe(HttpStatusCode.Redirect);

        var identityCookie = GetSetCookie(response, ".AspNetCore.Identity.Application");
        identityCookie.ShouldNotBeNull("Identity cookie was not issued by /Account/Login");

        var hasExpires = identityCookie!.Contains("expires=", StringComparison.OrdinalIgnoreCase);
        hasExpires.ShouldBe(rememberMe,
            $"RememberMe={rememberMe} should " +
            (rememberMe ? "issue a persistent cookie (with expires=)" : "issue a session cookie (no expires=)"));
    }

    [Fact]
    public async Task Login_WithRememberMe_StoresEncryptedCredentialsCookie()
    {
        var client = AuthFlow.CreateClient(factory);

        var response = await PostLoginAsync(client, rememberMe: true);
        response.StatusCode.ShouldBe(HttpStatusCode.Redirect);

        var setCookie = GetSetCookie(response, RememberedCredentialsCookieName);
        setCookie.ShouldNotBeNull("Remember me should issue a credentials cookie.");

        var value = CookieValue(setCookie!);
        value.ShouldNotBeNullOrEmpty();
        // Credentials must be encrypted at rest — never the plaintext email or password.
        value.ShouldNotContain(AuthSeeder.BootstrapSiteAdminEmail);
        value.ShouldNotContain(AuthSeeder.BootstrapSiteAdminPassword);
    }

    [Fact]
    public async Task Login_PageReload_PrefillsRememberedCredentials()
    {
        var client = AuthFlow.CreateClient(factory);

        // A prior login with Remember me checked plants the cookie (the client's jar keeps it).
        await PostLoginAsync(client, rememberMe: true);

        var page = await client.GetAsync("/Account/Login");
        page.StatusCode.ShouldBe(HttpStatusCode.OK);
        var html = await page.Content.ReadAsStringAsync();

        html.ShouldContain($@"value=""{AuthSeeder.BootstrapSiteAdminEmail}""");
        html.ShouldContain($@"value=""{AuthSeeder.BootstrapSiteAdminPassword}""");
        html.ShouldContain(@"name=""RememberMe"" value=""true"" checked");
    }

    [Fact]
    public async Task Login_WithoutRememberMe_ClearsRememberedCredentialsCookie()
    {
        var client = AuthFlow.CreateClient(factory);

        // Establish a remembered cookie, then sign in again with the box unchecked.
        await PostLoginAsync(client, rememberMe: true);
        var response = await PostLoginAsync(client, rememberMe: false);
        response.StatusCode.ShouldBe(HttpStatusCode.Redirect);

        var setCookie = GetSetCookie(response, RememberedCredentialsCookieName);
        setCookie.ShouldNotBeNull("Unchecking Remember me should clear the credentials cookie.");
        CookieValue(setCookie!).ShouldBeNullOrEmpty();
    }

    [Fact]
    public async Task Login_WithUnreadableCredentialsCookie_RendersWithoutErrorAndClearsCookie()
    {
        // A cookie that can't be decrypted (tampered, or encrypted with a retired
        // Data Protection key after rotation) must not break the login page.
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = false,
        });

        var request = new HttpRequestMessage(HttpMethod.Get, "/Account/Login");
        request.Headers.Add("Cookie", $"{RememberedCredentialsCookieName}=tampered-or-stale-payload");

        var response = await client.SendAsync(request);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var html = await response.Content.ReadAsStringAsync();
        html.ShouldNotContain(AuthSeeder.BootstrapSiteAdminEmail);

        // The unreadable cookie is dropped so it isn't retried on every load.
        var setCookie = GetSetCookie(response, RememberedCredentialsCookieName);
        setCookie.ShouldNotBeNull("An unreadable remembered-credentials cookie should be cleared.");
        CookieValue(setCookie!).ShouldBeNullOrEmpty();
    }

    private const string RememberedCredentialsCookieName = "RecordKeeping.RememberedCredentials";

    private static async Task<HttpResponseMessage> PostLoginAsync(HttpClient client, bool rememberMe)
    {
        var loginPage = await client.GetAsync("/Account/Login");
        loginPage.StatusCode.ShouldBe(HttpStatusCode.OK);
        var html = await loginPage.Content.ReadAsStringAsync();
        var afToken = Regex.Match(html,
            @"name=""__RequestVerificationToken""[^>]*value=""([^""]+)""").Groups[1].Value;
        afToken.ShouldNotBeNullOrEmpty();

        return await client.PostAsync("/Account/Login", new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("Email", AuthSeeder.BootstrapSiteAdminEmail),
            new KeyValuePair<string, string>("Password", AuthSeeder.BootstrapSiteAdminPassword),
            new KeyValuePair<string, string>("RememberMe", rememberMe ? "true" : "false"),
            new KeyValuePair<string, string>("__RequestVerificationToken", afToken),
        }));
    }

    private static string? GetSetCookie(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.FirstOrDefault(c => c.StartsWith(name + "=", StringComparison.Ordinal))
            : null;

    private static string CookieValue(string setCookie)
    {
        // "name=value; Path=/; ..." -> "value"
        var firstSegment = setCookie.Split(';', 2)[0];
        var eq = firstSegment.IndexOf('=');
        return eq >= 0 ? firstSegment[(eq + 1)..] : string.Empty;
    }
}
