using System.Net.Http.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Api.IntegrationTests.Auth;
using RecordKeeping.Api.Realtime;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;
using DomainOrg = RecordKeeping.Domain.Orgs.Org;

namespace RecordKeeping.Api.IntegrationTests.Realtime;

/// <summary>
/// Verifies the SiteAdmin-only live preview hub: an editor's pushed RDL is rendered and broadcast to
/// everyone watching the session; a watcher who joins mid-build is replayed the latest frames; and an
/// Org User (I-D13) or an unauthenticated caller is refused the connection.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class ReportPreviewHubTests(RecordKeepingApiFactory factory)
{
    private const string Password = "OrgUserPass!123";

    // The eight-byte PNG file signature; every pushed page image must start with it.
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private const string SampleRdl = """
        <?xml version="1.0" encoding="utf-8"?>
        <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rk="urn:recordkeeping:reportbuilder:v1">
          <rk:Template id="annual" name="Annual Emissions" version="1" snapToGrid="true" gridSize="0.125"/>
          <rk:PageNumbers show="true" format="Page {n} of {N}" startAt="1" position="right"/>
          <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin><RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>
          <Body><ReportItems>
            <Rectangle Name="Band_reportHeader">
              <rk:Band kind="reportHeader"/><Height>1in</Height>
              <ReportItems>
                <Textbox Name="title"><rk:Element type="dataField" expression="{Facility.Name}"/><Top>0.2in</Top><Left>0.42in</Left><Height>0.34in</Height><Width>5in</Width><Value>{Facility.Name}</Value></Textbox>
              </ReportItems>
            </Rectangle>
            <Rectangle Name="Band_detail">
              <rk:Band kind="detail"/><Height>0.3in</Height>
              <ReportItems>
                <Textbox Name="rec"><rk:Element type="dataField" expression="{Record.Field}"/><Top>0.04in</Top><Left>0.42in</Left><Height>0.22in</Height><Width>2in</Width><Value>{Record.Field}</Value></Textbox>
              </ReportItems>
            </Rectangle>
            <Rectangle Name="Band_pageFooter"><rk:Band kind="pageFooter"/><Height>0.35in</Height><ReportItems/></Rectangle>
          </ReportItems></Body>
        </Report>
        """;

    [Fact]
    public async Task PushRdl_BroadcastsRenderedFramesToSessionWatchers()
    {
        var token = await SiteAdminTokenAsync();
        var sessionId = $"tpl-{Guid.NewGuid():N}";

        await using var watcher = await ConnectAsync(token);
        var frames = FramesListener(watcher);
        await watcher.InvokeAsync("JoinSession", sessionId);

        await using var editor = await ConnectAsync(token);
        await editor.InvokeAsync("PushRdl", sessionId, SampleRdl);

        var pages = await frames.Task.WaitAsync(TimeSpan.FromSeconds(15));
        pages.Length.ShouldBeGreaterThan(0);
        pages[0].Take(PngSignature.Length).ShouldBe(PngSignature);
    }

    [Fact]
    public async Task JoinSession_AfterAPush_ReplaysLatestSnapshotToANewWatcher()
    {
        var token = await SiteAdminTokenAsync();
        var sessionId = $"tpl-{Guid.NewGuid():N}";

        // An editor pushes before anyone is watching; the snapshot is stored.
        await using var editor = await ConnectAsync(token);
        await editor.InvokeAsync("PushRdl", sessionId, SampleRdl);

        // A watcher joining afterwards is replayed the current state at once.
        await using var latecomer = await ConnectAsync(token);
        var frames = FramesListener(latecomer);
        await latecomer.InvokeAsync("JoinSession", sessionId);

        var pages = await frames.Task.WaitAsync(TimeSpan.FromSeconds(15));
        pages.Length.ShouldBeGreaterThan(0);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Connect_AsOrgUser_IsRefused()
    {
        var token = await OrgUserTokenAsync();

        await Should.ThrowAsync<HttpRequestException>(async () =>
        {
            await using var connection = await ConnectAsync(token);
        });
    }

    [Fact]
    public async Task Connect_Unauthenticated_IsRefused()
    {
        await Should.ThrowAsync<HttpRequestException>(async () =>
        {
            await using var connection = await ConnectAsync(accessToken: null);
        });
    }

    // Registers a one-shot listener for the next ReceiveFrames broadcast and returns its completion source.
    private static TaskCompletionSource<byte[][]> FramesListener(HubConnection connection)
    {
        var tcs = new TaskCompletionSource<byte[][]>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string, byte[][]>(ReportPreviewHub.ReceiveFramesMethod, (_, pages) => tcs.TrySetResult(pages));
        return tcs;
    }

    private async Task<HubConnection> ConnectAsync(string? accessToken)
    {
        var connection = new HubConnectionBuilder()
            .WithUrl($"{factory.Server.BaseAddress}hubs/report-preview", options =>
            {
                // TestServer speaks HTTP, not WebSockets, so drive the hub over long polling using the
                // in-memory test handler. The .NET client sends the token in the Authorization header.
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
                if (accessToken is not null)
                {
                    options.AccessTokenProvider = () => Task.FromResult<string?>(accessToken);
                }
            })
            .Build();

        await connection.StartAsync();
        return connection;
    }

    private async Task<string> SiteAdminTokenAsync()
    {
        // AuthFlow defaults to the seeded bootstrap SiteAdmin (admin@recordkeeping.local).
        var loginClient = AuthFlow.CreateClient(factory);
        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(loginClient);
        return await TokenAsync(loginClient, code);
    }

    private async Task<string> OrgUserTokenAsync()
    {
        var email = $"user-{Guid.NewGuid():N}@test.local";
        using (var scope = factory.Services.CreateScope())
        {
            var orgs = scope.ServiceProvider.GetRequiredService<IOrgRepository>();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

            var org = DomainOrg.Create($"Org-{Guid.NewGuid():N}").Value;
            await orgs.AddAsync(org, CancellationToken.None);
            await orgs.SaveChangesAsync(CancellationToken.None);

            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                DisplayName = "Test Org User",
                IsSiteAdmin = false,
                OrgId = org.Id,
            };
            (await users.CreateAsync(user, Password)).Succeeded.ShouldBeTrue();
        }

        var loginClient = AuthFlow.CreateClient(factory);
        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(loginClient, email, Password);
        return await TokenAsync(loginClient, code);
    }

    private static async Task<string> TokenAsync(HttpClient loginClient, string code)
    {
        var tokenResponse = await AuthFlow.ExchangeCodeForTokensAsync(loginClient, code);
        var tokens = (await tokenResponse.Content.ReadFromJsonAsync<TokenResponse>())!;
        return tokens.AccessToken;
    }
}
