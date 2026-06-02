using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Auth;

/// <summary>
/// Verifies the Development-only sample data seeded by <see cref="AuthSeeder.SeedDevelopmentDataAsync"/>:
/// a sample Org (<see cref="AuthSeeder.DevOrgName"/>) and an Org User belonging to it, so a developer
/// can sign in as a non-SiteAdmin and exercise Org-scoped flows locally. Seeding is idempotent across
/// restarts.
/// </summary>
[Collection(nameof(IntegrationTestCollection))]
public class AuthSeederDevelopmentDataTests(RecordKeepingApiFactory factory)
{
    /// <summary>
    /// A Development-environment host sharing the assembly's SQL Server. Building it runs the
    /// <c>Program.cs</c> startup, which seeds the dev Org + Org User because the environment is
    /// now Development. The caller disposes it.
    /// </summary>
    private WebApplicationFactory<Program> CreateDevelopmentHost() =>
        factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

    [Fact]
    public async Task Development_SeedsDevOrg()
    {
        using var dev = CreateDevelopmentHost();
        using var scope = dev.Services.CreateScope();
        var orgs = scope.ServiceProvider.GetRequiredService<IOrgRepository>();

        var all = await orgs.GetAllAsync(CancellationToken.None);

        all.ShouldContain(o => o.Name == AuthSeeder.DevOrgName);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public async Task Development_SeedsDevOrgUser_BelongingToDevOrg()
    {
        using var dev = CreateDevelopmentHost();
        using var scope = dev.Services.CreateScope();
        var orgs = scope.ServiceProvider.GetRequiredService<IOrgRepository>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var devOrg = (await orgs.GetAllAsync(CancellationToken.None))
            .Single(o => o.Name == AuthSeeder.DevOrgName);
        var user = await users.FindByEmailAsync(AuthSeeder.DevOrgUserEmail);

        user.ShouldNotBeNull();
        user!.IsSiteAdmin.ShouldBeFalse();      // I-D13: an Org User is never a SiteAdmin.
        user.OrgId.ShouldNotBeNull();           // I-D13: an Org User belongs to exactly one Org.
        user.OrgId!.Value.ShouldBe(devOrg.Id);  // ...specifically, the seeded dev Org.
    }

    [Fact]
    public async Task Development_SeedsAreIdempotent()
    {
        using var dev = CreateDevelopmentHost();

        // Startup already seeded once; seeding again must not create a second dev Org.
        using (var scope = dev.Services.CreateScope())
        {
            await AuthSeeder.SeedDevelopmentDataAsync(scope.ServiceProvider);
        }

        using var verify = dev.Services.CreateScope();
        var orgs = verify.ServiceProvider.GetRequiredService<IOrgRepository>();
        var all = await orgs.GetAllAsync(CancellationToken.None);

        all.Count(o => o.Name == AuthSeeder.DevOrgName).ShouldBe(1);
    }
}
