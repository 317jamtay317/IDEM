using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenIddict.Abstractions;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace RecordKeeping.Infrastructure.Identity;

/// <summary>
/// Idempotent startup seeder. Ensures the OpenIddict SPA client and a
/// bootstrap SiteAdmin User exist; safe to call on every startup.
/// </summary>
public static class AuthSeeder
{
    /// <summary>The bootstrap SiteAdmin's email. Replace once a real SiteAdmin signs up.</summary>
    public const string BootstrapSiteAdminEmail = "admin@recordkeeping.local";

    /// <summary>The bootstrap SiteAdmin's initial password. Printed to console on first seed.</summary>
    public const string BootstrapSiteAdminPassword = "ChangeMe!OnFirstLogin1";

    /// <summary>
    /// Display name of the sample Org seeded in Development (see
    /// <see cref="SeedDevelopmentDataAsync"/>). Deliberately distinct from the bare
    /// "Rieth-Riley" used by tests and fixtures so seeded dev data never collides with them.
    /// </summary>
    public const string DevOrgName = "Rieth-Riley (Development)";

    /// <summary>Email of the sample Development Org User, who belongs to the <see cref="DevOrgName"/> Org.</summary>
    public const string DevOrgUserEmail = "user@recordkeeping.local";

    /// <summary>The sample Development Org User's initial password. Local convenience only.</summary>
    public const string DevOrgUserPassword = "ChangeMe!OnFirstLogin1";

    /// <summary>The SPA OIDC client identifier registered with OpenIddict.</summary>
    public const string SpaClientId = "spa";

    /// <summary>
    /// The OAuth scope that grants access to the MCP tool surface. AI agents request this
    /// scope; the MCP endpoint requires it (see Api <c>McpUser</c> policy and I-D16).
    /// </summary>
    public const string McpScopeName = "mcp";

    /// <summary>The SPA OIDC client's canonical redirect URI (used by integration tests).</summary>
    public const string SpaRedirectUri = "https://localhost/callback";

    /// <summary>The SPA OIDC client's canonical post-logout redirect URI.</summary>
    public const string SpaPostLogoutRedirectUri = "https://localhost/";

    // First host port in the docker-compose floating range. The launcher (scripts/up.ps1) and
    // docker-compose.yml claim the first free host port at or above this value for each
    // concurrently-running stack (one per git worktree), so the SPA can be served from any
    // port in [Start, End]. Every such origin must be a registered redirect URI or the floated
    // stack's login fails with ID2043 (invalid redirect_uri). The band of 20 ports covers ~10
    // parallel stacks (each stack publishes an api + an mcp port).
    private const int DockerComposePortBandStart = 8443;
    private const int DockerComposePortBandEnd = 8462;

    /// <summary>
    /// Additional dev/local URIs registered alongside <see cref="SpaRedirectUri"/>
    /// so the SPA's <c>window.location.origin + "/callback"</c> resolves under
    /// every reasonable local-run permutation (docker-compose on any floated host port,
    /// dotnet run http/https, Vite dev server) without re-seeding.
    /// </summary>
    private static readonly Uri[] AdditionalSpaRedirectUris = BuildLocalDevUris("/callback");

    private static readonly Uri[] AdditionalSpaPostLogoutRedirectUris = BuildLocalDevUris("/");

    // Builds the docker-compose host-port band (https://localhost:{port}{path}) plus the fixed
    // dotnet-run and Vite origins. The same shape serves redirect ("/callback") and post-logout
    // ("/") URIs, so both lists stay in sync as the band grows.
    private static Uri[] BuildLocalDevUris(string path)
    {
        var dockerComposeBand = Enumerable
            .Range(DockerComposePortBandStart, DockerComposePortBandEnd - DockerComposePortBandStart + 1)
            .Select(port => new Uri($"https://localhost:{port}{path}"));

        var fixedOrigins = new[]
        {
            new Uri($"https://localhost:7099{path}"), // dotnet run, https profile
            new Uri($"http://localhost:5182{path}"),  // dotnet run, http profile
            new Uri($"http://localhost:8080{path}"),  // docker-compose (legacy http)
            new Uri($"http://localhost:5173{path}"),  // Vite dev server
        };

        return dockerComposeBand.Concat(fixedOrigins).ToArray();
    }

    /// <summary>
    /// Seeds the SPA OIDC client and the bootstrap SiteAdmin if they don't exist.
    /// </summary>
    /// <param name="services">A scoped service provider.</param>
    public static async Task SeedAsync(IServiceProvider services)
    {
        await SeedMcpScopeAsync(services);
        await SeedSpaClientAsync(services);
        await SeedSiteAdminAsync(services);
    }

    /// <summary>
    /// Seeds a sample <see cref="DevOrgName"/> Org and an Org User belonging to it, so a developer
    /// can sign in as a non-SiteAdmin and exercise Org-scoped behavior locally. Seeds only when the
    /// host runs in the Development environment; otherwise it is a no-op. Idempotent and safe to call
    /// on every startup. Must run after the domain schema exists (the Org is persisted).
    /// </summary>
    /// <param name="services">A scoped service provider.</param>
    public static async Task SeedDevelopmentDataAsync(IServiceProvider services)
    {
        var environment = services.GetRequiredService<IHostEnvironment>();
        if (!environment.IsDevelopment())
        {
            return;
        }

        var orgId = await SeedDevOrgAsync(services);
        await SeedDevOrgUserAsync(services, orgId);
    }

    private static async Task<Guid> SeedDevOrgAsync(IServiceProvider services)
    {
        var orgs = services.GetRequiredService<IOrgRepository>();

        var existing = await orgs.GetAllAsync(CancellationToken.None);
        var devOrg = existing.FirstOrDefault(o => o.Name == DevOrgName);
        if (devOrg is not null)
        {
            return devOrg.Id;
        }

        // The Org aggregate owns its own creation invariants (name validation).
        var created = Org.Create(DevOrgName);
        if (created.IsError)
        {
            throw new InvalidOperationException(
                "Failed to seed development Org: " +
                string.Join("; ", created.Errors.Select(e => e.Description)));
        }

        await orgs.AddAsync(created.Value, CancellationToken.None);
        await orgs.SaveChangesAsync(CancellationToken.None);
        return created.Value.Id;
    }

    private static async Task SeedDevOrgUserAsync(IServiceProvider services, Guid orgId)
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        if (await userManager.FindByEmailAsync(DevOrgUserEmail) is not null)
        {
            return;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = DevOrgUserEmail,
            Email = DevOrgUserEmail,
            EmailConfirmed = true,
            DisplayName = "Rieth-Riley Dev User",
            IsSiteAdmin = false, // I-D13: an Org User is never a SiteAdmin.
            OrgId = orgId,       // I-D13: an Org User belongs to exactly one Org.
        };

        var result = await userManager.CreateAsync(user, DevOrgUserPassword);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                "Failed to seed development Org User: " +
                string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        // Surface the dev credentials so the operator can sign in as an Org User locally.
        Console.WriteLine(
            $"[AuthSeeder] Seeded development Org User: {DevOrgUserEmail} / {DevOrgUserPassword} (Org: {DevOrgName})");
    }

    private static async Task SeedMcpScopeAsync(IServiceProvider services)
    {
        var manager = services.GetRequiredService<IOpenIddictScopeManager>();

        if (await manager.FindByNameAsync(McpScopeName) is not null)
        {
            return;
        }

        // Declared as a first-class scope so it appears in discovery (scopes_supported) and can
        // be granted to dynamically-registered MCP clients. No resource is associated: the MCP
        // endpoint authorizes on the scope claim, and the resource/audience is host-dynamic.
        await manager.CreateAsync(new OpenIddictScopeDescriptor
        {
            Name = McpScopeName,
            DisplayName = "MCP access",
            Description = "Grants an AI agent access to the RecordKeeping MCP tool surface.",
        });
    }

    private static async Task SeedSpaClientAsync(IServiceProvider services)
    {
        var manager = services.GetRequiredService<IOpenIddictApplicationManager>();
        var descriptor = BuildSpaClientDescriptor();

        var existing = await manager.FindByClientIdAsync(SpaClientId);
        if (existing is null)
        {
            await manager.CreateAsync(descriptor);
            return;
        }

        // Reconcile the existing client with the desired configuration. This keeps the
        // registered redirect URIs in sync when dev ports/schemes change (e.g. moving the
        // docker-compose stack to HTTPS), so logins don't fail with ID2043 (invalid
        // redirect_uri) and no database wipe is required. Idempotent when already correct.
        await manager.UpdateAsync(existing, descriptor);
    }

    private static OpenIddictApplicationDescriptor BuildSpaClientDescriptor()
    {
        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = SpaClientId,
            ClientType = ClientTypes.Public,
            ApplicationType = ApplicationTypes.Web,
            ConsentType = ConsentTypes.Implicit,
            DisplayName = "RecordKeeping SPA",
            RedirectUris = { new Uri(SpaRedirectUri) },
            PostLogoutRedirectUris = { new Uri(SpaPostLogoutRedirectUri) },
            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.EndSession,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Email,
                Permissions.Scopes.Profile,
                Permissions.Prefixes.Scope + Scopes.OfflineAccess,
            },
            Requirements =
            {
                Requirements.Features.ProofKeyForCodeExchange,
            },
        };

        foreach (var uri in AdditionalSpaRedirectUris)
        {
            descriptor.RedirectUris.Add(uri);
        }
        foreach (var uri in AdditionalSpaPostLogoutRedirectUris)
        {
            descriptor.PostLogoutRedirectUris.Add(uri);
        }

        return descriptor;
    }

    private static async Task SeedSiteAdminAsync(IServiceProvider services)
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();

        if (await userManager.FindByEmailAsync(BootstrapSiteAdminEmail) is not null)
        {
            return;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = BootstrapSiteAdminEmail,
            Email = BootstrapSiteAdminEmail,
            EmailConfirmed = true,
            DisplayName = "Site Administrator",
            IsSiteAdmin = true,
            OrgId = null, // I-D13: SiteAdmins have no Org.
        };

        var result = await userManager.CreateAsync(user, BootstrapSiteAdminPassword);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                "Failed to seed SiteAdmin: " +
                string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        // Surface the bootstrap credentials so the operator can sign in once.
        // Production-grade seeding would write to a secret store and require rotation.
        Console.WriteLine(
            $"[AuthSeeder] Seeded bootstrap SiteAdmin: {BootstrapSiteAdminEmail} / {BootstrapSiteAdminPassword}");
    }
}
