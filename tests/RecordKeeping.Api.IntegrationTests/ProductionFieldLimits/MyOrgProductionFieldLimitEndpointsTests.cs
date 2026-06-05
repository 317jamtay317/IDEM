using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Api.IntegrationTests.Auth;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFieldLimits;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;
using DomainOrg = RecordKeeping.Domain.Orgs.Org;

namespace RecordKeeping.Api.IntegrationTests.ProductionFieldLimits;

/// <summary>
/// Verifies the Org User self-service Production Field Limit endpoints
/// (<c>/me/org/production-field-limits</c>): an Org User sets and reads per-field limits scoped to the
/// caller's <c>org_id</c> claim. Covers the upsert / one-limit-per-field rule (I-D24), the
/// Low ≤ High rule (I-D25), field-catalog validation, the SiteAdmin exclusion (I-D13), and Org
/// isolation (I-D03).
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class MyOrgProductionFieldLimitEndpointsTests(RecordKeepingApiFactory factory)
{
    private const string Password = "OrgUserPass!123";
    private const string Property = "PercentSulfurNumber2";

    private sealed record SetLimitRequest(decimal LowLimit, decimal HighLimit, string Unit);

    private sealed record LimitResponse(string PropertyName, decimal LowLimit, decimal HighLimit, string Unit);

    private sealed record SeededOrg(Guid OrgId, string Email);

    [Fact]
    public async Task Put_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/me/org/production-field-limits/{Property}", new SetLimitRequest(0m, 2m, "Percentage"));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    [Trait("Invariant", "I-D24")]
    public async Task Put_AsOrgUser_CreatesLimitAndPersists()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.PutAsJsonAsync(
            $"/me/org/production-field-limits/{Property}", new SetLimitRequest(0m, 2.5m, "Percentage"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var created = await response.Content.ReadFromJsonAsync<LimitResponse>();
        created.ShouldNotBeNull();
        created!.PropertyName.ShouldBe(Property);
        created.LowLimit.ShouldBe(0m);
        created.HighLimit.ShouldBe(2.5m);
        created.Unit.ShouldBe("Percentage");

        // It round-trips through SQL with decimal precision.
        using var scope = factory.Services.CreateScope();
        var limits = scope.ServiceProvider.GetRequiredService<IProductionFieldLimitRepository>();
        var persisted = await limits.GetByPropertyAsync(seeded.OrgId, Property, CancellationToken.None);
        persisted.ShouldNotBeNull();
        persisted!.LowLimit.ShouldBe(0m);
        persisted.HighLimit.ShouldBe(2.5m);
        persisted.Unit.ShouldBe(LimitUnit.Percentage);
    }

    [Fact]
    [Trait("Invariant", "I-D24")]
    public async Task Put_Twice_UpdatesInPlaceWithoutDuplicating()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);

        (await client.PutAsJsonAsync($"/me/org/production-field-limits/{Property}",
            new SetLimitRequest(0m, 2m, "Percentage"))).StatusCode.ShouldBe(HttpStatusCode.OK);
        var second = await client.PutAsJsonAsync($"/me/org/production-field-limits/{Property}",
            new SetLimitRequest(1m, 3m, "Tons"));

        second.StatusCode.ShouldBe(HttpStatusCode.OK);
        var limits = await client.GetFromJsonAsync<List<LimitResponse>>("/me/org/production-field-limits");
        limits.ShouldNotBeNull();
        // I-D24: still one limit for the field, updated in place rather than duplicated.
        limits!.Count(l => l.PropertyName == Property).ShouldBe(1);
        var limit = limits.Single(l => l.PropertyName == Property);
        limit.HighLimit.ShouldBe(3m);
        limit.Unit.ShouldBe("Tons");
    }

    [Fact]
    public async Task Put_WithUnknownField_Returns400()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.PutAsJsonAsync(
            "/me/org/production-field-limits/NotARealField", new SetLimitRequest(0m, 2m, "Tons"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait("Invariant", "I-D25")]
    public async Task Put_WithLowAboveHigh_Returns400()
    {
        var seeded = await SeedOrgWithUserAsync();
        var client = await AuthenticatedClientAsync(seeded.Email);

        var response = await client.PutAsJsonAsync(
            $"/me/org/production-field-limits/{Property}", new SetLimitRequest(5m, 1m, "Percentage"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Put_AsSiteAdmin_Returns403()
    {
        var client = await AuthenticatedClientAsync(
            AuthSeeder.BootstrapSiteAdminEmail, AuthSeeder.BootstrapSiteAdminPassword);

        var response = await client.PutAsJsonAsync(
            $"/me/org/production-field-limits/{Property}", new SetLimitRequest(0m, 2m, "Percentage"));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Get_WithoutToken_Returns401()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/me/org/production-field-limits");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Get_AsOrgUser_ReturnsOwnOrgsLimits()
    {
        var seeded = await SeedOrgWithUserAsync();
        await SeedLimitAsync(seeded.OrgId, "HotMix", 0m, 100m, LimitUnit.Tons);
        await SeedLimitAsync(seeded.OrgId, "ColdMix", 0m, 50m, LimitUnit.Tons);
        var client = await AuthenticatedClientAsync(seeded.Email);

        var limits = await client.GetFromJsonAsync<List<LimitResponse>>("/me/org/production-field-limits");

        limits.ShouldNotBeNull();
        limits!.Count.ShouldBe(2);
        limits.ShouldContain(l => l.PropertyName == "HotMix" && l.HighLimit == 100m);
        limits.ShouldContain(l => l.PropertyName == "ColdMix" && l.HighLimit == 50m);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Get_DoesNotReturnAnotherOrgsLimits()
    {
        var orgA = await SeedOrgWithUserAsync();
        var orgB = await SeedOrgWithUserAsync();
        await SeedLimitAsync(orgA.OrgId, "HotMix", 0m, 100m, LimitUnit.Tons);
        await SeedLimitAsync(orgB.OrgId, "ColdMix", 0m, 50m, LimitUnit.Tons);
        var clientA = await AuthenticatedClientAsync(orgA.Email);

        var limits = await clientA.GetFromJsonAsync<List<LimitResponse>>("/me/org/production-field-limits");

        // I-D03: Org A sees only its own limits, never Org B's.
        limits.ShouldNotBeNull();
        limits!.ShouldAllBe(l => l.PropertyName == "HotMix");
        limits.ShouldNotContain(l => l.PropertyName == "ColdMix");
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Get_AsSiteAdmin_Returns403()
    {
        var client = await AuthenticatedClientAsync(
            AuthSeeder.BootstrapSiteAdminEmail, AuthSeeder.BootstrapSiteAdminPassword);

        var response = await client.GetAsync("/me/org/production-field-limits");

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private async Task<SeededOrg> SeedOrgWithUserAsync()
    {
        using var scope = factory.Services.CreateScope();
        var orgs = scope.ServiceProvider.GetRequiredService<IOrgRepository>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var org = DomainOrg.Create($"Org-{Guid.NewGuid():N}").Value;
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

        return new SeededOrg(org.Id, email);
    }

    private async Task SeedLimitAsync(Guid orgId, string propertyName, decimal low, decimal high, LimitUnit unit)
    {
        using var scope = factory.Services.CreateScope();
        var limits = scope.ServiceProvider.GetRequiredService<IProductionFieldLimitRepository>();
        var limit = ProductionFieldLimit.Create(orgId, propertyName, low, high, unit).Value;
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
