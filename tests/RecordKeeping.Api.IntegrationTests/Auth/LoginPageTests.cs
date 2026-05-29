using System.Net;
using System.Text.RegularExpressions;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

[Collection(nameof(IntegrationTestCollection))]
public class LoginPageTests(RecordKeepingApiFactory factory)
{
    [Theory]
    [InlineData("true", true)]   // checkbox checked -> persistent cookie (has expires)
    [InlineData("false", false)] // checkbox unchecked -> session cookie (no expires)
    public async Task Login_RememberMe_ControlsCookiePersistence(string rememberMeFormValue, bool expectPersistent)
    {
        var client = AuthFlow.CreateClient(factory);

        // Get AF token from the login page.
        var loginPage = await client.GetAsync("/Account/Login");
        loginPage.StatusCode.ShouldBe(HttpStatusCode.OK);
        var html = await loginPage.Content.ReadAsStringAsync();
        var afToken = Regex.Match(html,
            @"name=""__RequestVerificationToken""[^>]*value=""([^""]+)""").Groups[1].Value;
        afToken.ShouldNotBeNullOrEmpty();

        var response = await client.PostAsync("/Account/Login", new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("Email", AuthSeeder.BootstrapSiteAdminEmail),
            new KeyValuePair<string, string>("Password", AuthSeeder.BootstrapSiteAdminPassword),
            new KeyValuePair<string, string>("RememberMe", rememberMeFormValue),
            new KeyValuePair<string, string>("__RequestVerificationToken", afToken),
        }));

        response.StatusCode.ShouldBe(HttpStatusCode.Redirect);

        var setCookies = response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.ToList()
            : new List<string>();
        var identityCookie = setCookies.FirstOrDefault(c =>
            c.StartsWith(".AspNetCore.Identity.Application"));
        identityCookie.ShouldNotBeNull("Identity cookie was not issued by /Account/Login");

        var hasExpires = identityCookie!.Contains("expires=", StringComparison.OrdinalIgnoreCase);
        hasExpires.ShouldBe(expectPersistent,
            $"RememberMe={rememberMeFormValue} should " +
            (expectPersistent ? "issue a persistent cookie (with expires=)" : "issue a session cookie (no expires=)"));
    }
}
