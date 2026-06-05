using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Api.IntegrationTests.Auth;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;
using DomainOrg = RecordKeeping.Domain.Orgs.Org;

namespace RecordKeeping.Api.IntegrationTests.Reporting;

/// <summary>
/// Verifies the SiteAdmin-only Report Template preview endpoint
/// (<c>POST /api/report-templates/preview</c>): a SiteAdmin renders a template's RDL to a PDF; an
/// Org User is rejected (I-D13); an unauthenticated caller is rejected; and malformed RDL is a 400.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class ReportTemplatePreviewEndpointsTests(RecordKeepingApiFactory factory)
{
    private const string Password = "OrgUserPass!123";
    private const string PreviewPath = "/api/report-templates/preview";

    private sealed record PreviewRequest(string Rdl);

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
    public async Task Preview_AsSiteAdmin_ReturnsRenderedPdf()
    {
        var client = await SiteAdminClientAsync();

        var response = await client.PostAsJsonAsync(PreviewPath, new PreviewRequest(SampleRdl));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/pdf");
        var bytes = await response.Content.ReadAsByteArrayAsync();
        bytes.Length.ShouldBeGreaterThan(1000);
        Encoding.ASCII.GetString(bytes, 0, 5).ShouldBe("%PDF-");
    }

    [Fact]
    public async Task Preview_WithMalformedRdl_Returns400()
    {
        var client = await SiteAdminClientAsync();

        var response = await client.PostAsJsonAsync(PreviewPath, new PreviewRequest("<Report><not-closed>"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Preview_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(PreviewPath, new PreviewRequest(SampleRdl));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Preview_AsOrgUser_Returns403()
    {
        var client = await OrgUserClientAsync();

        var response = await client.PostAsJsonAsync(PreviewPath, new PreviewRequest(SampleRdl));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private async Task<HttpClient> SiteAdminClientAsync()
    {
        // AuthFlow defaults to the seeded bootstrap SiteAdmin (admin@recordkeeping.local).
        var loginClient = AuthFlow.CreateClient(factory);
        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(loginClient);
        return await AuthenticatedClientAsync(loginClient, code);
    }

    private async Task<HttpClient> OrgUserClientAsync()
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
        return await AuthenticatedClientAsync(loginClient, code);
    }

    private async Task<HttpClient> AuthenticatedClientAsync(HttpClient loginClient, string code)
    {
        var tokenResponse = await AuthFlow.ExchangeCodeForTokensAsync(loginClient, code);
        var tokens = (await tokenResponse.Content.ReadFromJsonAsync<TokenResponse>())!;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        return client;
    }
}
