using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Api.IntegrationTests.Auth;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;
using DomainOrg = RecordKeeping.Domain.Orgs.Org;

namespace RecordKeeping.Api.IntegrationTests.ReportTemplates;

/// <summary>
/// Verifies the SiteAdmin-only Report Template CRUD endpoints under <c>api/report-templates</c>: a
/// SiteAdmin can create, list, load, and update saved templates; an Org User is rejected (I-D13); an
/// unauthenticated caller is rejected; and an unknown id is a 404.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class ReportTemplateEndpointsTests(RecordKeepingApiFactory factory)
{
    private const string Password = "OrgUserPass!123";
    private const string BasePath = "/api/report-templates";

    private const string Rdl =
        "<?xml version=\"1.0\" encoding=\"utf-8\"?><Report xmlns=\"urn:x\"><Body/></Report>";

    private sealed record CreateRequest(string Name, string Rdl);
    private sealed record UpdateRequest(string Name, string Rdl);
    private sealed record TemplateDto(Guid Id, string Name, string Rdl, DateTime CreatedAtUtc, DateTime UpdatedAtUtc);

    [Fact]
    public async Task Create_AsSiteAdmin_PersistsAndReturnsCreated()
    {
        var client = await SiteAdminClientAsync();

        var response = await client.PostAsJsonAsync(BasePath, new CreateRequest("Annual Emissions", Rdl));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = (await response.Content.ReadFromJsonAsync<TemplateDto>())!;
        created.Id.ShouldNotBe(Guid.Empty);
        created.Name.ShouldBe("Annual Emissions");
        created.Rdl.ShouldBe(Rdl);
    }

    [Fact]
    public async Task List_AsSiteAdmin_IncludesACreatedTemplate()
    {
        var client = await SiteAdminClientAsync();
        var name = $"Listed-{Guid.NewGuid():N}";
        await client.PostAsJsonAsync(BasePath, new CreateRequest(name, Rdl));

        var list = (await client.GetFromJsonAsync<List<TemplateDto>>(BasePath))!;

        list.ShouldContain(t => t.Name == name);
    }

    [Fact]
    public async Task GetById_AsSiteAdmin_ReturnsTheTemplateWithRdl()
    {
        var client = await SiteAdminClientAsync();
        var created = await CreateAsync(client, "Loadable");

        var fetched = (await client.GetFromJsonAsync<TemplateDto>($"{BasePath}/{created.Id}"))!;

        fetched.Id.ShouldBe(created.Id);
        fetched.Rdl.ShouldBe(Rdl);
    }

    [Fact]
    public async Task Update_AsSiteAdmin_ChangesNameAndRdl()
    {
        var client = await SiteAdminClientAsync();
        var created = await CreateAsync(client, "Before");

        var newRdl = "<Report xmlns=\"urn:x\"><Page/></Report>";
        var response = await client.PutAsJsonAsync(
            $"{BasePath}/{created.Id}", new UpdateRequest("After", newRdl));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var updated = (await response.Content.ReadFromJsonAsync<TemplateDto>())!;
        updated.Id.ShouldBe(created.Id);
        updated.Name.ShouldBe("After");
        updated.Rdl.ShouldBe(newRdl);
    }

    [Fact]
    public async Task GetById_WithUnknownId_Returns404()
    {
        var client = await SiteAdminClientAsync();

        var response = await client.GetAsync($"{BasePath}/{Guid.NewGuid()}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_AsSiteAdmin_RemovesTheTemplate()
    {
        var client = await SiteAdminClientAsync();
        var created = await CreateAsync(client, "ToDelete");

        var deleteResponse = await client.DeleteAsync($"{BasePath}/{created.Id}");

        deleteResponse.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var afterDelete = await client.GetAsync($"{BasePath}/{created.Id}");
        afterDelete.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_WithUnknownId_Returns404()
    {
        var client = await SiteAdminClientAsync();

        var response = await client.DeleteAsync($"{BasePath}/{Guid.NewGuid()}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Delete_AsOrgUser_Returns403()
    {
        var client = await OrgUserClientAsync();

        var response = await client.DeleteAsync($"{BasePath}/{Guid.NewGuid()}");

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Create_WithBlankName_Returns400()
    {
        var client = await SiteAdminClientAsync();

        var response = await client.PostAsJsonAsync(BasePath, new CreateRequest("   ", Rdl));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task List_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(BasePath);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Create_AsOrgUser_Returns403()
    {
        var client = await OrgUserClientAsync();

        var response = await client.PostAsJsonAsync(BasePath, new CreateRequest("Annual Emissions", Rdl));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private async Task<TemplateDto> CreateAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync(BasePath, new CreateRequest(name, Rdl));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<TemplateDto>())!;
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
