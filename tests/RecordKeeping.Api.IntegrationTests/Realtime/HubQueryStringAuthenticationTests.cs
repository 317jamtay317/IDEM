using Microsoft.AspNetCore.Http;
using RecordKeeping.Api.Realtime;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Realtime;

/// <summary>
/// Verifies the WebSocket auth shim: a browser cannot set the Authorization header on a WebSocket
/// handshake, so the SignalR client sends the access token in the <c>access_token</c> query string.
/// The shim copies it into the Authorization header for hub requests, and leaves everything else alone.
/// </summary>
public class HubQueryStringAuthenticationTests
{
    private static readonly PathString HubPath = ReportPreviewHub.Path;

    private static DefaultHttpContext Request(string path, string? accessToken, string? authHeader = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        if (accessToken is not null)
        {
            context.Request.QueryString = new QueryString($"?access_token={accessToken}");
        }

        if (authHeader is not null)
        {
            context.Request.Headers.Authorization = authHeader;
        }

        return context;
    }

    [Fact]
    public void CopiesAccessTokenToBearerHeader_ForHubPath()
    {
        var context = Request(ReportPreviewHub.Path, "tok123");

        HubQueryStringAuthentication.ApplyAccessTokenFromQueryString(context, HubPath);

        context.Request.Headers.Authorization.ToString().ShouldBe("Bearer tok123");
    }

    [Fact]
    public void DoesNotOverwriteAnExistingAuthorizationHeader()
    {
        var context = Request(ReportPreviewHub.Path, "tok123", authHeader: "Bearer original");

        HubQueryStringAuthentication.ApplyAccessTokenFromQueryString(context, HubPath);

        context.Request.Headers.Authorization.ToString().ShouldBe("Bearer original");
    }

    [Fact]
    public void IgnoresRequestsOutsideTheHubPath()
    {
        var context = Request("/api/report-templates/preview", "tok123");

        HubQueryStringAuthentication.ApplyAccessTokenFromQueryString(context, HubPath);

        context.Request.Headers.Authorization.Count.ShouldBe(0);
    }

    [Fact]
    public void IgnoresHubRequestsWithoutAnAccessToken()
    {
        var context = Request(ReportPreviewHub.Path, accessToken: null);

        HubQueryStringAuthentication.ApplyAccessTokenFromQueryString(context, HubPath);

        context.Request.Headers.Authorization.Count.ShouldBe(0);
    }
}
