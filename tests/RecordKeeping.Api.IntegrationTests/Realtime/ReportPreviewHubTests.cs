using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Api.IntegrationTests.Auth;
using RecordKeeping.Api.Realtime;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Application.Reporting;
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

    [Fact]
    public async Task JoinSession_BroadcastsRoster_AndReplaysToLateJoiner_WithIdentityFromToken()
    {
        var token = await SiteAdminTokenAsync();
        var sessionId = $"tpl-{Guid.NewGuid():N}";

        await using var first = await ConnectAsync(token);
        var firstSeesBoth = ParticipantsWhen(first, ps => ps.Length >= 2);
        await first.InvokeAsync("JoinSession", sessionId);

        await using var second = await ConnectAsync(token);
        var secondSeesBoth = ParticipantsWhen(second, ps => ps.Length >= 2);
        await second.InvokeAsync("JoinSession", sessionId);

        var rosterForFirst = await firstSeesBoth.WaitAsync(TimeSpan.FromSeconds(15));
        var rosterForSecond = await secondSeesBoth.WaitAsync(TimeSpan.FromSeconds(15));

        rosterForFirst.Length.ShouldBe(2);
        rosterForSecond.Length.ShouldBe(2);
        // Identity is server-derived from the token (the client sent no name/id) — anti-spoofing, I-D13.
        rosterForSecond.ShouldAllBe(p => p.DisplayName == "Site Administrator");
        rosterForSecond.ShouldAllBe(p => !string.IsNullOrEmpty(p.UserId));
    }

    [Fact]
    public async Task UpdateSelection_BroadcastsTheUpdatedSelectionToWatchers()
    {
        var token = await SiteAdminTokenAsync();
        var sessionId = $"tpl-{Guid.NewGuid():N}";

        await using var editor = await ConnectAsync(token);
        await editor.InvokeAsync("JoinSession", sessionId);
        await using var watcher = await ConnectAsync(token);
        await watcher.InvokeAsync("JoinSession", sessionId);

        var sawSelection = ParticipantsWhen(watcher, ps => ps.Any(p => p.SelectedElementIds.Contains("el-a")));
        await editor.InvokeAsync("UpdateSelection", new[] { "el-a" });

        var roster = await sawSelection.WaitAsync(TimeSpan.FromSeconds(15));
        roster.ShouldContain(p => p.SelectedElementIds.Contains("el-a"));
    }

    [Fact]
    public async Task ClaimElement_BroadcastsLockWithHolderFromToken_AndReturnsTheHolder()
    {
        var token = await SiteAdminTokenAsync();
        var sessionId = $"tpl-{Guid.NewGuid():N}";

        await using var editor = await ConnectAsync(token);
        await editor.InvokeAsync("JoinSession", sessionId);
        await using var watcher = await ConnectAsync(token);
        await watcher.InvokeAsync("JoinSession", sessionId);

        var sawLock = LocksWhen(watcher, ls => ls.Any(l => l.ElementId == "el-a"));
        var holder = await editor.InvokeAsync<PreviewLock?>("ClaimElement", "el-a");

        holder.ShouldNotBeNull();
        holder.ElementId.ShouldBe("el-a");
        holder.ConnectionId.ShouldBe(editor.ConnectionId);
        holder.DisplayName.ShouldBe("Site Administrator");

        var locks = await sawLock.WaitAsync(TimeSpan.FromSeconds(15));
        locks.ShouldContain(l => l.ElementId == "el-a" && l.DisplayName == "Site Administrator");
    }

    [Fact]
    public async Task ClaimElement_BySecondConnection_DoesNotStealTheHolder()
    {
        var token = await SiteAdminTokenAsync();
        var sessionId = $"tpl-{Guid.NewGuid():N}";

        await using var editor = await ConnectAsync(token);
        await editor.InvokeAsync("JoinSession", sessionId);
        await editor.InvokeAsync("ClaimElement", "el-a");

        await using var contender = await ConnectAsync(token);
        await contender.InvokeAsync("JoinSession", sessionId);
        var contended = await contender.InvokeAsync<PreviewLock?>("ClaimElement", "el-a");

        contended.ShouldNotBeNull();
        contended.ConnectionId.ShouldBe(editor.ConnectionId); // still the first claimant — advisory, no steal.
    }

    [Fact]
    public async Task Disconnect_RemovesParticipant_AndReleasesItsLocks_ForRemainingWatcher()
    {
        var token = await SiteAdminTokenAsync();
        var sessionId = $"tpl-{Guid.NewGuid():N}";

        await using var watcher = await ConnectAsync(token);
        await watcher.InvokeAsync("JoinSession", sessionId);

        // Listen before the editor acts, so the pre-state broadcasts can't fire before we subscribe.
        var watcherSeesBoth = ParticipantsWhen(watcher, ps => ps.Length == 2);
        var watcherSeesLock = LocksWhen(watcher, ls => ls.Any(l => l.ElementId == "el-a"));

        var editor = await ConnectAsync(token);
        await editor.InvokeAsync("JoinSession", sessionId);
        await editor.InvokeAsync("ClaimElement", "el-a");

        // Establish the pre-state on the watcher: both participants present and the lock held.
        await watcherSeesBoth.WaitAsync(TimeSpan.FromSeconds(15));
        await watcherSeesLock.WaitAsync(TimeSpan.FromSeconds(15));

        var backToOne = ParticipantsWhen(watcher, ps => ps.Length == 1);
        var lockReleased = LocksWhen(watcher, ls => ls.Length == 0);
        await editor.DisposeAsync(); // a disconnect must clean up the gone editor's presence and locks.

        (await backToOne.WaitAsync(TimeSpan.FromSeconds(20))).Length.ShouldBe(1);
        (await lockReleased.WaitAsync(TimeSpan.FromSeconds(20))).ShouldBeEmpty();
    }

    [Fact]
    public async Task CollaborationMethods_BeforeJoiningASession_AreNoOps()
    {
        var token = await SiteAdminTokenAsync();
        await using var connection = await ConnectAsync(token);

        // The connection has not joined any session, so it cannot act on one (it can't publish presence
        // or locks into a session it never joined — the session is resolved server-side, not from args).
        var holder = await connection.InvokeAsync<PreviewLock?>("ClaimElement", "el-a");
        holder.ShouldBeNull();

        // These must complete without error even though the caller belongs to no session.
        await Should.NotThrowAsync(connection.InvokeAsync("UpdateSelection", new[] { "el-a" }));
        await Should.NotThrowAsync(connection.InvokeAsync("ReleaseElement", "el-a"));
    }

    // Registers a one-shot listener for the next ReceiveFrames broadcast and returns its completion source.
    private static TaskCompletionSource<byte[][]> FramesListener(HubConnection connection)
    {
        var tcs = new TaskCompletionSource<byte[][]>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string, byte[][]>(ReportPreviewHub.ReceiveFramesMethod, (_, pages) => tcs.TrySetResult(pages));
        return tcs;
    }

    // Completes when a ParticipantsChanged broadcast satisfies the predicate (e.g. a target roster size).
    private static Task<PreviewParticipant[]> ParticipantsWhen(
        HubConnection connection, Func<PreviewParticipant[], bool> ready)
    {
        var tcs = new TaskCompletionSource<PreviewParticipant[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string, PreviewParticipant[]>(
            ReportPreviewHub.ParticipantsChangedMethod,
            (_, participants) =>
            {
                if (ready(participants)) tcs.TrySetResult(participants);
            });
        return tcs.Task;
    }

    // Completes when a LocksChanged broadcast satisfies the predicate.
    private static Task<PreviewLock[]> LocksWhen(HubConnection connection, Func<PreviewLock[], bool> ready)
    {
        var tcs = new TaskCompletionSource<PreviewLock[]>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string, PreviewLock[]>(
            ReportPreviewHub.LocksChangedMethod,
            (_, locks) =>
            {
                if (ready(locks)) tcs.TrySetResult(locks);
            });
        return tcs.Task;
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
            // Match the hub's camelCase payload naming so PreviewParticipant/PreviewLock round-trip.
            .AddJsonProtocol(options =>
                options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase)
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
