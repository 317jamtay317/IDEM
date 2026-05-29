using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;
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

    /// <summary>The SPA OIDC client identifier registered with OpenIddict.</summary>
    public const string SpaClientId = "spa";

    /// <summary>The SPA OIDC client's canonical redirect URI (used by integration tests).</summary>
    public const string SpaRedirectUri = "https://localhost/callback";

    /// <summary>The SPA OIDC client's canonical post-logout redirect URI.</summary>
    public const string SpaPostLogoutRedirectUri = "https://localhost/";

    /// <summary>
    /// Additional dev/local URIs registered alongside <see cref="SpaRedirectUri"/>
    /// so the SPA's <c>window.location.origin + "/callback"</c> resolves under
    /// every reasonable local-run permutation (docker-compose, dotnet run http/https,
    /// Vite dev server) without re-seeding.
    /// </summary>
    private static readonly Uri[] AdditionalSpaRedirectUris =
    {
        new("https://localhost:7099/callback"), // dotnet run, https profile
        new("http://localhost:5182/callback"),  // dotnet run, http profile
        new("http://localhost:8080/callback"),  // docker-compose
        new("http://localhost:5173/callback"),  // Vite dev server
    };

    private static readonly Uri[] AdditionalSpaPostLogoutRedirectUris =
    {
        new("https://localhost:7099/"),
        new("http://localhost:5182/"),
        new("http://localhost:8080/"),
        new("http://localhost:5173/"),
    };

    /// <summary>
    /// Seeds the SPA OIDC client and the bootstrap SiteAdmin if they don't exist.
    /// </summary>
    /// <param name="services">A scoped service provider.</param>
    public static async Task SeedAsync(IServiceProvider services)
    {
        await SeedSpaClientAsync(services);
        await SeedSiteAdminAsync(services);
    }

    private static async Task SeedSpaClientAsync(IServiceProvider services)
    {
        var manager = services.GetRequiredService<IOpenIddictApplicationManager>();

        if (await manager.FindByClientIdAsync(SpaClientId) is not null)
        {
            return;
        }

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

        await manager.CreateAsync(descriptor);
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
