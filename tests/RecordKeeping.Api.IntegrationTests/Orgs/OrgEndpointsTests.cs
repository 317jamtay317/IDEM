using System.Net;
using System.Net.Http.Json;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Orgs;

[Collection(nameof(IntegrationTestCollection))]
public class OrgEndpointsTests(RecordKeepingApiFactory factory)
{
    private sealed record CreateOrgRequest(string Name);
    private sealed record UpdateOrgRequest(string Name, Guid? TenantId);
    private sealed record FacilityResponse(Guid Id, string Name);
    private sealed record OrgResponse(Guid Id, string Name, Guid? TenantId, IReadOnlyList<FacilityResponse> Facilities);

    private static async Task<OrgResponse> CreateOrgAsync(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/orgs", new CreateOrgRequest(name));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<OrgResponse>())!;
    }

    [Fact]
    public async Task Post_WithValidName_CreatesOrg()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/orgs", new CreateOrgRequest("Rieth-Riley"));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var org = await response.Content.ReadFromJsonAsync<OrgResponse>();
        org.ShouldNotBeNull();
        org!.Id.ShouldNotBe(Guid.Empty);
        org.Name.ShouldBe("Rieth-Riley");
        org.TenantId.ShouldBeNull();
        org.Facilities.ShouldBeEmpty();
        response.Headers.Location!.OriginalString.ShouldContain(org.Id.ToString());
    }

    [Fact]
    public async Task Post_WithEmptyName_Returns400()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/orgs", new CreateOrgRequest("   "));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetById_AfterCreate_ReturnsOrg()
    {
        var client = factory.CreateClient();
        var created = await CreateOrgAsync(client, "Goshen Paving");

        var response = await client.GetAsync($"/orgs/{created.Id}");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var org = await response.Content.ReadFromJsonAsync<OrgResponse>();
        org!.Id.ShouldBe(created.Id);
        org.Name.ShouldBe("Goshen Paving");
    }

    [Fact]
    public async Task GetById_WhenMissing_Returns404()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/orgs/{Guid.NewGuid()}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetAll_IncludesCreatedOrg()
    {
        var client = factory.CreateClient();
        var created = await CreateOrgAsync(client, "Fort Wayne Asphalt");

        var response = await client.GetAsync("/orgs");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var orgs = await response.Content.ReadFromJsonAsync<List<OrgResponse>>();
        orgs.ShouldNotBeNull();
        orgs.ShouldContain(o => o.Id == created.Id);
    }

    [Fact]
    public async Task Put_ConfiguresSso_PersistsTenantId()
    {
        var client = factory.CreateClient();
        var created = await CreateOrgAsync(client, "SSO Co");
        var tenantId = Guid.NewGuid();

        var response = await client.PutAsJsonAsync(
            $"/orgs/{created.Id}", new UpdateOrgRequest("SSO Co", tenantId));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<OrgResponse>();
        updated!.TenantId.ShouldBe(tenantId);

        // Confirm it persisted.
        var reread = await client.GetFromJsonAsync<OrgResponse>($"/orgs/{created.Id}");
        reread!.TenantId.ShouldBe(tenantId);
    }

    [Fact]
    public async Task Put_AttemptingRename_Returns409()
    {
        var client = factory.CreateClient();
        var created = await CreateOrgAsync(client, "Original Name");

        var response = await client.PutAsJsonAsync(
            $"/orgs/{created.Id}", new UpdateOrgRequest("Renamed", null));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Put_WhenMissing_Returns404()
    {
        var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/orgs/{Guid.NewGuid()}", new UpdateOrgRequest("Whatever", null));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_RemovesOrg()
    {
        var client = factory.CreateClient();
        var created = await CreateOrgAsync(client, "Doomed Co");

        var delete = await client.DeleteAsync($"/orgs/{created.Id}");
        delete.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var getAfter = await client.GetAsync($"/orgs/{created.Id}");
        getAfter.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_WhenMissing_Returns404()
    {
        var client = factory.CreateClient();

        var response = await client.DeleteAsync($"/orgs/{Guid.NewGuid()}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
