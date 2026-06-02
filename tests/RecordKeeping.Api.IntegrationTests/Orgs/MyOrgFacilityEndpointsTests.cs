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

namespace RecordKeeping.Api.IntegrationTests.Orgs;

/// <summary>
/// Verifies the Org User self-service Facility endpoints (<c>/me/org/facilities</c>): an Org User
/// manages their own Org's Facilities, scoped to the caller's <c>org_id</c> claim. The Org
/// isolation cases (I-D03) prove one Org's user can never see or mutate another Org's Facilities.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class MyOrgFacilityEndpointsTests(RecordKeepingApiFactory factory)
{
    private const string Password = "OrgUserPass!123";

    private sealed record FacilityRequest(string Name);
    private sealed record FacilityResponse(Guid Id, string Name);
    private sealed record SeededOrg(Guid OrgId, Guid FacilityId, string FacilityName, string Email);

    [Fact]
    public async Task Get_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/me/org/facilities");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Post_AsOrgUser_AddsFacilityToOwnOrg()
    {
        var seeded = await SeedOrgWithUserAsync("Goshen Plant");
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.PostAsJsonAsync(
            "/me/org/facilities", new FacilityRequest("Fort Wayne Plant"));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<FacilityResponse>();
        created.ShouldNotBeNull();
        created!.Name.ShouldBe("Fort Wayne Plant");

        var list = await client.GetFromJsonAsync<List<FacilityResponse>>("/me/org/facilities");
        var names = list!.Select(f => f.Name).ToList();
        names.ShouldContain("Goshen Plant");
        names.ShouldContain("Fort Wayne Plant");
        names.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Post_WithEmptyName_Returns400()
    {
        var seeded = await SeedOrgWithUserAsync("Goshen Plant");
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.PostAsJsonAsync("/me/org/facilities", new FacilityRequest("   "));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Put_RenamesOwnFacility()
    {
        var seeded = await SeedOrgWithUserAsync("Goshen Plant");
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.PutAsJsonAsync(
            $"/me/org/facilities/{seeded.FacilityId}", new FacilityRequest("Goshen Asphalt Plant"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<FacilityResponse>();
        updated!.Id.ShouldBe(seeded.FacilityId);
        updated.Name.ShouldBe("Goshen Asphalt Plant");
    }

    [Fact]
    public async Task Delete_RemovesOwnFacility()
    {
        var seeded = await SeedOrgWithUserAsync("Goshen Plant");
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.DeleteAsync($"/me/org/facilities/{seeded.FacilityId}");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var list = await client.GetFromJsonAsync<List<FacilityResponse>>("/me/org/facilities");
        list!.ShouldNotContain(f => f.Id == seeded.FacilityId);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Get_AsOrgUser_ReturnsOnlyOwnOrgFacilities()
    {
        var orgA = await SeedOrgWithUserAsync("Org A Plant");
        var orgB = await SeedOrgWithUserAsync("Org B Plant");
        var clientA = await AuthenticatedClientAsync(orgA.Email);

        var list = await clientA.GetFromJsonAsync<List<FacilityResponse>>("/me/org/facilities");

        list.ShouldNotBeNull();
        list!.ShouldContain(f => f.Id == orgA.FacilityId);
        // I-D03: Org A's user must never see Org B's facility.
        list.ShouldNotContain(f => f.Id == orgB.FacilityId);
        list.ShouldNotContain(f => f.Name == "Org B Plant");
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task OrgUser_CannotRenameAnotherOrgsFacility_Returns404()
    {
        var orgA = await SeedOrgWithUserAsync("Org A Plant");
        var orgB = await SeedOrgWithUserAsync("Org B Plant");
        var clientA = await AuthenticatedClientAsync(orgA.Email);

        // Org A's user targets Org B's facility id; scoped to Org A, it is not found.
        var response = await clientA.PutAsJsonAsync(
            $"/me/org/facilities/{orgB.FacilityId}", new FacilityRequest("Hijacked"));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // I-D03: Org B's facility is untouched.
        var clientB = await AuthenticatedClientAsync(orgB.Email);
        var list = await clientB.GetFromJsonAsync<List<FacilityResponse>>("/me/org/facilities");
        list!.ShouldContain(f => f.Id == orgB.FacilityId && f.Name == "Org B Plant");
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task OrgUser_CannotDeleteAnotherOrgsFacility_Returns404()
    {
        var orgA = await SeedOrgWithUserAsync("Org A Plant");
        var orgB = await SeedOrgWithUserAsync("Org B Plant");
        var clientA = await AuthenticatedClientAsync(orgA.Email);

        var response = await clientA.DeleteAsync($"/me/org/facilities/{orgB.FacilityId}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // I-D03: Org B's facility is untouched.
        var clientB = await AuthenticatedClientAsync(orgB.Email);
        var list = await clientB.GetFromJsonAsync<List<FacilityResponse>>("/me/org/facilities");
        list!.ShouldContain(f => f.Id == orgB.FacilityId);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Post_AsSiteAdmin_Returns403()
    {
        // The bootstrap SiteAdmin has no Org (I-D13), so the "my Org" facility routes don't apply.
        var client = await AuthenticatedClientAsync(
            AuthSeeder.BootstrapSiteAdminEmail, AuthSeeder.BootstrapSiteAdminPassword);

        var response = await client.PostAsJsonAsync("/me/org/facilities", new FacilityRequest("Nope"));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private async Task<SeededOrg> SeedOrgWithUserAsync(string facilityName)
    {
        using var scope = factory.Services.CreateScope();
        var orgs = scope.ServiceProvider.GetRequiredService<IOrgRepository>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var org = DomainOrg.Create($"Org-{Guid.NewGuid():N}").Value;
        var facility = org.AddFacility(facilityName).Value;
        await orgs.AddAsync(org, CancellationToken.None);
        await orgs.SaveChangesAsync(CancellationToken.None);

        var email = $"user-{Guid.NewGuid():N}@test.local";
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            DisplayName = "Test Org User",
            IsSiteAdmin = false, // I-D13: an Org User is never a SiteAdmin.
            OrgId = org.Id,      // I-D13: an Org User belongs to exactly one Org.
        };
        (await users.CreateAsync(user, Password)).Succeeded.ShouldBeTrue();

        return new SeededOrg(org.Id, facility.Id, facilityName, email);
    }

    private async Task<HttpClient> AuthenticatedClientAsync(string email, string password = Password)
    {
        var loginClient = AuthFlow.CreateClient(factory);
        var code = await AuthFlow.LoginAndGetAuthorizationCodeAsync(loginClient, email, password);
        var tokenResponse = await AuthFlow.ExchangeCodeForTokensAsync(loginClient, code);
        var tokens = (await tokenResponse.Content.ReadFromJsonAsync<TokenResponse>())!;

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        return client;
    }
}
