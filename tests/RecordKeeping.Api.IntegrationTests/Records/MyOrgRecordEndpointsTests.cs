using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Api.IntegrationTests.Auth;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Application.Records;
using RecordKeeping.Domain.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFields;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;
using DomainOrg = RecordKeeping.Domain.Orgs.Org;
using DomainFacility = RecordKeeping.Domain.Facilities.Facility;
using DomainRecord = RecordKeeping.Domain.Records.Record;
using DomainRecordValue = RecordKeeping.Domain.Records.RecordValue;

namespace RecordKeeping.Api.IntegrationTests.Records;

/// <summary>
/// Verifies the Org User self-service Record endpoints (<c>/me/org/records</c>): an Org User logs and
/// reads Records for their own Org's Facilities, scoped to the caller's <c>org_id</c> claim. Covers the
/// one-Record-per-Facility-per-date rule (I-D23), value/catalog validation, the read/search filters,
/// and — for every read — the Org isolation case (I-D03) that an Org User can never see, log against,
/// or fetch another Org's Records.
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
        string PropertyName, decimal? NumericValue, bool? BooleanValue, DateOnly? DateValue,
        string? Exceedance = null);

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

    [Fact]
    public async Task Get_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/me/org/records");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Get_AsOrgUser_ReturnsOwnOrgsRecords_NewestFirst()
    {
        var seeded = await SeedOrgWithUserAsync();
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 27), 100m);
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 29), 300m);
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 28), 200m);
        var client = await AuthenticatedClientAsync(seeded.Email);

        var records = await client.GetFromJsonAsync<List<RecordResponse>>("/me/org/records");

        records.ShouldNotBeNull();
        records!.Count.ShouldBe(3);
        records.Select(r => r.Date).ShouldBe(new[]
        {
            new DateOnly(2026, 5, 29),
            new DateOnly(2026, 5, 28),
            new DateOnly(2026, 5, 27),
        });
        records[0].Values.ShouldContain(v => v.PropertyName == "HotMix" && v.NumericValue == 300m);
    }

    [Fact]
    public async Task Get_FilteredByFacility_ReturnsOnlyThatFacilitysRecords()
    {
        var seeded = await SeedOrgWithUserAsync();
        var otherFacilityId = await SeedFacilityAsync(seeded.OrgId, "Fort Wayne Plant");
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, Day, 1m);
        await SeedRecordAsync(seeded.OrgId, otherFacilityId, Day, 2m);
        var client = await AuthenticatedClientAsync(seeded.Email);

        var records = await client.GetFromJsonAsync<List<RecordResponse>>(
            $"/me/org/records?facilityId={seeded.FacilityId}");

        records.ShouldNotBeNull();
        records!.ShouldHaveSingleItem().FacilityId.ShouldBe(seeded.FacilityId);
    }

    [Fact]
    public async Task Get_FilteredByDateRange_ReturnsOnlyRecordsInRange()
    {
        var seeded = await SeedOrgWithUserAsync();
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 1), 1m);
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 10), 2m);
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 20), 3m);
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 31), 4m);
        var client = await AuthenticatedClientAsync(seeded.Email);

        var records = await client.GetFromJsonAsync<List<RecordResponse>>(
            "/me/org/records?from=2026-05-10&to=2026-05-20");

        records.ShouldNotBeNull();
        records!.Select(r => r.Date).ShouldBe(new[]
        {
            new DateOnly(2026, 5, 20),
            new DateOnly(2026, 5, 10),
        });
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Get_DoesNotReturnAnotherOrgsRecords()
    {
        var orgA = await SeedOrgWithUserAsync();
        var orgB = await SeedOrgWithUserAsync();
        await SeedRecordAsync(orgA.OrgId, orgA.FacilityId, Day, 1m);
        await SeedRecordAsync(orgB.OrgId, orgB.FacilityId, Day, 2m);
        var clientA = await AuthenticatedClientAsync(orgA.Email);

        var records = await clientA.GetFromJsonAsync<List<RecordResponse>>("/me/org/records");

        // I-D03: Org A sees only its own Facility's Records, never Org B's.
        records.ShouldNotBeNull();
        records!.ShouldAllBe(r => r.FacilityId == orgA.FacilityId);
        records.ShouldNotContain(r => r.FacilityId == orgB.FacilityId);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Get_AsSiteAdmin_Returns403()
    {
        var client = await AuthenticatedClientAsync(
            AuthSeeder.BootstrapSiteAdminEmail, AuthSeeder.BootstrapSiteAdminPassword);

        var response = await client.GetAsync("/me/org/records");

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetById_AsOrgUser_ReturnsTheRecord()
    {
        var seeded = await SeedOrgWithUserAsync();
        var recordId = await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, Day, 1240.5m);
        var client = await AuthenticatedClientAsync(seeded.Email);

        var record = await client.GetFromJsonAsync<RecordResponse>($"/me/org/records/{recordId}");

        record.ShouldNotBeNull();
        record!.Id.ShouldBe(recordId);
        record.FacilityId.ShouldBe(seeded.FacilityId);
        record.Date.ShouldBe(Day);
        record.Values.ShouldContain(v => v.PropertyName == "HotMix" && v.NumericValue == 1240.5m);
    }

    [Fact]
    public async Task GetById_Unknown_Returns404()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.GetAsync($"/me/org/records/{Guid.NewGuid()}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task GetById_ForAnotherOrgsRecord_Returns404()
    {
        var orgA = await SeedOrgWithUserAsync();
        var orgB = await SeedOrgWithUserAsync();
        var orgBRecordId = await SeedRecordAsync(orgB.OrgId, orgB.FacilityId, Day, 1m);
        var clientA = await AuthenticatedClientAsync(orgA.Email);

        // I-D03: Org A asks for Org B's Record by id; scoped to Org A, it is not found.
        var response = await clientA.GetAsync($"/me/org/records/{orgBRecordId}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_AnnotatesValues_WithExceedanceAgainstOrgLimits()
    {
        var seeded = await SeedOrgWithUserAsync();
        await SeedLimitAsync(seeded.OrgId, "HotMix", low: 0m, high: 200m);
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 29), 300m); // above 200
        await SeedRecordAsync(seeded.OrgId, seeded.FacilityId, new DateOnly(2026, 5, 28), 150m); // within
        var client = await AuthenticatedClientAsync(seeded.Email);

        var records = await client.GetFromJsonAsync<List<RecordResponse>>("/me/org/records");

        records.ShouldNotBeNull();
        HotMixOn(records!, new DateOnly(2026, 5, 29)).Exceedance.ShouldBe("Above");
        HotMixOn(records!, new DateOnly(2026, 5, 28)).Exceedance.ShouldBe("Within");
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Get_DoesNotApplyAnotherOrgsLimits_ToExceedance()
    {
        var orgA = await SeedOrgWithUserAsync();
        var orgB = await SeedOrgWithUserAsync();
        // Org B sets a tight limit; Org A sets none. Org A's value must not be classified by Org B's limit.
        await SeedLimitAsync(orgB.OrgId, "HotMix", low: 0m, high: 1m);
        await SeedRecordAsync(orgA.OrgId, orgA.FacilityId, Day, 300m);
        var clientA = await AuthenticatedClientAsync(orgA.Email);

        var records = await clientA.GetFromJsonAsync<List<RecordResponse>>("/me/org/records");

        // I-D03: with no limit of its own, Org A's value is unannotated — Org B's limit never applies.
        records.ShouldNotBeNull();
        HotMixOn(records!, Day).Exceedance.ShouldBeNull();
    }

    private static RecordValueResponse HotMixOn(List<RecordResponse> records, DateOnly date) =>
        records.Single(r => r.Date == date).Values.Single(v => v.PropertyName == "HotMix");

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

    private async Task<Guid> SeedFacilityAsync(Guid orgId, string name)
    {
        using var scope = factory.Services.CreateScope();
        var facilities = scope.ServiceProvider.GetRequiredService<IFacilityRepository>();
        var facility = DomainFacility.Create(orgId, name).Value;
        await facilities.AddAsync(facility, CancellationToken.None);
        await facilities.SaveChangesAsync(CancellationToken.None);
        return facility.Id;
    }

    private async Task<Guid> SeedRecordAsync(Guid orgId, Guid facilityId, DateOnly date, decimal hotMix)
    {
        using var scope = factory.Services.CreateScope();
        var records = scope.ServiceProvider.GetRequiredService<IRecordRepository>();
        var record = DomainRecord.Create(orgId, facilityId, date).Value;
        record.AddValue(
            DomainRecordValue.Create("HotMix", ProductionFieldDataType.Decimal, hotMix).Value);
        await records.AddAsync(record, CancellationToken.None);
        await records.SaveChangesAsync(CancellationToken.None);
        return record.Id;
    }

    private async Task SeedLimitAsync(Guid orgId, string propertyName, decimal low, decimal high)
    {
        using var scope = factory.Services.CreateScope();
        var limits = scope.ServiceProvider.GetRequiredService<IProductionFieldLimitRepository>();
        var limit = ProductionFieldLimit.Create(orgId, propertyName, low, high, LimitUnit.Tons).Value;
        await limits.AddAsync(limit, CancellationToken.None);
        await limits.SaveChangesAsync(CancellationToken.None);
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
