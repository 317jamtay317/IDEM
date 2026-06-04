using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Api.IntegrationTests.Auth;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Application.Records;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;
using DomainOrg = RecordKeeping.Domain.Orgs.Org;
using DomainFacility = RecordKeeping.Domain.Facilities.Facility;

namespace RecordKeeping.Api.IntegrationTests.Records;

/// <summary>
/// Verifies the Org User self-service Record endpoint (<c>POST /me/org/records</c>): an Org User logs
/// a Record for one of their own Org's Facilities, scoped to the caller's <c>org_id</c> claim. Covers
/// the one-Record-per-Facility-per-date rule (I-D23), value/catalog validation, and the Org isolation
/// case (I-D03) that an Org User can never log against another Org's Facility.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class MyOrgRecordEndpointsTests(RecordKeepingApiFactory factory)
{
    private const string Password = "OrgUserPass!123";
    private static readonly DateOnly Day = new(2026, 5, 29);

    private sealed record RecordValueRequest(
        string PropertyName,
        decimal? NumericValue = null,
        bool? BooleanValue = null,
        DateOnly? DateValue = null);

    private sealed record RecordRequest(Guid FacilityId, DateOnly Date, IReadOnlyList<RecordValueRequest> Values);

    private sealed record RecordValueResponse(
        string PropertyName, decimal? NumericValue, bool? BooleanValue, DateOnly? DateValue);

    private sealed record RecordResponse(
        Guid Id, Guid FacilityId, DateOnly Date, IReadOnlyList<RecordValueResponse> Values);

    private sealed record SeededOrg(Guid OrgId, Guid FacilityId, string Email);

    [Fact]
    public async Task Post_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/me/org/records",
            new RecordRequest(Guid.NewGuid(), Day, [new RecordValueRequest("HotMix", NumericValue: 1m)]));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    [Trait("Invariant", "I-D23")]
    public async Task Post_AsOrgUser_LogsRecordForOwnFacilityAndPersists()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.PostAsJsonAsync(
            "/me/org/records",
            new RecordRequest(seeded.FacilityId, Day,
            [
                new RecordValueRequest("HotMix", NumericValue: 1240.5m),
                new RecordValueRequest("IsOperated", BooleanValue: true),
            ]));

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<RecordResponse>();
        created.ShouldNotBeNull();
        created!.FacilityId.ShouldBe(seeded.FacilityId);
        created.Date.ShouldBe(Day);
        created.Values.ShouldContain(v => v.PropertyName == "HotMix" && v.NumericValue == 1240.5m);
        created.Values.ShouldContain(v => v.PropertyName == "IsOperated" && v.BooleanValue == true);

        // It round-trips through SQL (incl. the sparse RecordValues table and decimal precision).
        using var scope = factory.Services.CreateScope();
        var records = scope.ServiceProvider.GetRequiredService<IRecordRepository>();
        var persisted = await records.GetByFacilityAndDateAsync(
            seeded.OrgId, seeded.FacilityId, Day, CancellationToken.None);
        persisted.ShouldNotBeNull();
        persisted!.Values.ShouldContain(v => v.PropertyName == "HotMix" && v.NumericValue == 1240.5m);
        persisted.Values.ShouldContain(v => v.PropertyName == "IsOperated" && v.BooleanValue == true);
    }

    [Fact]
    [Trait("Invariant", "I-D23")]
    public async Task Post_TwiceForSameFacilityAndDate_Returns409()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);
        var request = new RecordRequest(seeded.FacilityId, Day, [new RecordValueRequest("HotMix", NumericValue: 1m)]);

        (await client.PostAsJsonAsync("/me/org/records", request)).StatusCode.ShouldBe(HttpStatusCode.Created);
        var second = await client.PostAsJsonAsync("/me/org/records", request);

        second.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Post_WithUnknownField_Returns400()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.PostAsJsonAsync(
            "/me/org/records",
            new RecordRequest(seeded.FacilityId, Day, [new RecordValueRequest("NotARealField", NumericValue: 1m)]));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Post_WithValueTypeNotMatchingFieldDataType_Returns400()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);

        // HotMix is a Decimal field; supplying only a boolean value is invalid.
        var response = await client.PostAsJsonAsync(
            "/me/org/records",
            new RecordRequest(seeded.FacilityId, Day, [new RecordValueRequest("HotMix", BooleanValue: true)]));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Post_AsSiteAdmin_Returns403()
    {
        // The bootstrap SiteAdmin has no Org (I-D13), so the "my Org" record route does not apply.
        var client = await AuthenticatedClientAsync(
            AuthSeeder.BootstrapSiteAdminEmail, AuthSeeder.BootstrapSiteAdminPassword);

        var response = await client.PostAsJsonAsync(
            "/me/org/records",
            new RecordRequest(Guid.NewGuid(), Day, [new RecordValueRequest("HotMix", NumericValue: 1m)]));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Post_ToAnotherOrgsFacility_Returns404AndDoesNotPersist()
    {
        var orgA = await SeedOrgWithUserAsync();
        var orgB = await SeedOrgWithUserAsync();
        var clientA = await AuthenticatedClientAsync(orgA.Email);

        // I-D03: Org A's user targets Org B's facility id; scoped to Org A, it is not found.
        var response = await clientA.PostAsJsonAsync(
            "/me/org/records",
            new RecordRequest(orgB.FacilityId, Day, [new RecordValueRequest("HotMix", NumericValue: 1m)]));

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // I-D03: nothing was written against Org B's Facility.
        using var scope = factory.Services.CreateScope();
        var records = scope.ServiceProvider.GetRequiredService<IRecordRepository>();
        var leaked = await records.GetByFacilityAndDateAsync(
            orgB.OrgId, orgB.FacilityId, Day, CancellationToken.None);
        leaked.ShouldBeNull();
    }

    private async Task<SeededOrg> SeedOrgWithUserAsync()
    {
        using var scope = factory.Services.CreateScope();
        var orgs = scope.ServiceProvider.GetRequiredService<IOrgRepository>();
        var facilities = scope.ServiceProvider.GetRequiredService<IFacilityRepository>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var org = DomainOrg.Create($"Org-{Guid.NewGuid():N}").Value;
        await orgs.AddAsync(org, CancellationToken.None);
        await orgs.SaveChangesAsync(CancellationToken.None);

        var facility = DomainFacility.Create(org.Id, "Goshen Plant").Value;
        await facilities.AddAsync(facility, CancellationToken.None);
        await facilities.SaveChangesAsync(CancellationToken.None);

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

        return new SeededOrg(org.Id, facility.Id, email);
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
