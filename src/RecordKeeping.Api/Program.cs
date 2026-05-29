using System.Security.Claims;
using Microsoft.AspNetCore; // for OpenIddictServerAspNetCoreHelpers extension methods
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using OpenIddict.Validation.AspNetCore;
using RecordKeeping.Infrastructure.Identity;
using static OpenIddict.Abstractions.OpenIddictConstants;

var builder = WebApplication.CreateBuilder(args);

// --- Configuration -----------------------------------------------------------

var connectionString = builder.Configuration.GetConnectionString("RecordKeeping")
    ?? throw new InvalidOperationException("ConnectionStrings:RecordKeeping is required.");

// --- Services ----------------------------------------------------------------

// OpenAPI metadata - endpoint documentation per Architecture.md.
builder.Services.AddOpenApi();

// Razor Pages for the server-rendered login page (auth-code redirect target).
builder.Services.AddRazorPages();

// EF Core + Identity + OpenIddict storage (auth schema, see Architecture.md §Auth).
builder.Services.AddDbContext<AuthDbContext>(options =>
{
    options.UseSqlServer(connectionString);
    options.UseOpenIddict();
});

// ASP.NET Core Identity (I-D14: passwords stored as hashes only).
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
    {
        // NIST 2024 password policy: length over complexity, no forced rotation.
        options.Password.RequiredLength = 12;
        options.Password.RequireDigit = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireLowercase = false;

        // I-D04: email uniqueness is per-Org, not global.
        options.User.RequireUniqueEmail = false;
    })
    .AddEntityFrameworkStores<AuthDbContext>()
    .AddDefaultTokenProviders();

// Cookie scheme used by the Razor login page. Login challenges redirect here.
builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.LogoutPath = "/Account/Logout";
    options.AccessDeniedPath = "/Account/Login";
});

// OpenIddict server + validation. Authorization Code + PKCE only.
builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore()
            .UseDbContext<AuthDbContext>();
    })
    .AddServer(options =>
    {
        options.SetAuthorizationEndpointUris("/connect/authorize")
            .SetTokenEndpointUris("/connect/token")
            .SetEndSessionEndpointUris("/connect/logout")
            .SetUserInfoEndpointUris("/connect/userinfo");

        options.AllowAuthorizationCodeFlow()
            .RequireProofKeyForCodeExchange()
            .AllowRefreshTokenFlow();

        options.RegisterScopes(Scopes.Email, Scopes.Profile, Scopes.OfflineAccess);

        // Dev/test ephemeral keys. Production replaces with persistent certs.
        options.AddEphemeralEncryptionKey()
            .AddEphemeralSigningKey();

        var aspNet = options.UseAspNetCore()
            .EnableAuthorizationEndpointPassthrough()
            .EnableTokenEndpointPassthrough()
            .EnableEndSessionEndpointPassthrough()
            .EnableUserInfoEndpointPassthrough()
            .EnableStatusCodePagesIntegration();

        // OpenIddict rejects non-HTTPS requests by default. The test server is
        // HTTP-only and Azure Container Apps terminates TLS at the load balancer.
        // TODO before prod: enable UseForwardedHeaders + re-enable this check so
        // we still reject anything not arriving over TLS at the edge.
        if (builder.Environment.IsDevelopment() || builder.Environment.EnvironmentName == "Testing")
        {
            aspNet.DisableTransportSecurityRequirement();
        }

        options.SetAccessTokenLifetime(TimeSpan.FromMinutes(15));
        options.SetRefreshTokenLifetime(TimeSpan.FromDays(7));
    })
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
    });

// API endpoints use the OpenIddict validation scheme (challenges with 401),
// not Identity's cookie scheme (which would 302-redirect to a login page).
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ApiUser", new AuthorizationPolicyBuilder(
            OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build());
});

// --- Build & Pipeline --------------------------------------------------------

var app = builder.Build();

// Initialize the auth schema and seed the SPA client + bootstrap SiteAdmin.
// EnsureCreated is acceptable pre-launch; migrate to EF migrations when the
// schema stabilizes.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    await db.Database.EnsureCreatedAsync();
    await AuthSeeder.SeedAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// SPA static assets, then auth, then endpoints.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();

// OpenIddict authorization endpoint. With EnableAuthorizationEndpointPassthrough,
// OpenIddict validates the request and forwards execution here; we handle the
// authn check + sign-in.
app.MapMethods("/connect/authorize", new[] { "GET", "POST" }, async (HttpContext context) =>
{
    var request = context.GetOpenIddictServerRequest()
        ?? throw new InvalidOperationException("OpenIddict request not present.");

    var auth = await context.AuthenticateAsync(IdentityConstants.ApplicationScheme);

    if (!auth.Succeeded || auth.Principal?.Identity?.IsAuthenticated != true)
    {
        // Not signed in - challenge the cookie scheme which redirects to LoginPath.
        return Results.Challenge(
            properties: new AuthenticationProperties
            {
                RedirectUri = context.Request.Path + context.Request.QueryString,
            },
            authenticationSchemes: new[] { IdentityConstants.ApplicationScheme });
    }

    // Signed in - issue an OpenIddict auth code.
    var userManager = context.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
    var user = await userManager.GetUserAsync(auth.Principal)
        ?? throw new InvalidOperationException("Signed-in principal has no matching user.");

    var identity = new ClaimsIdentity(
        authenticationType: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
        nameType: Claims.Name,
        roleType: Claims.Role);

    identity.SetClaim(Claims.Subject, user.Id.ToString());
    identity.SetClaim(Claims.Email, user.Email ?? string.Empty);
    identity.SetClaim(Claims.Name, user.DisplayName);
    identity.SetClaim("is_site_admin", user.IsSiteAdmin ? "true" : "false");

    identity.SetScopes(request.GetScopes());
    identity.SetDestinations(static _ => new[] { Destinations.AccessToken, Destinations.IdentityToken });

    return Results.SignIn(
        new ClaimsPrincipal(identity),
        properties: null,
        authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
});

// OpenIddict token endpoint. With EnableTokenEndpointPassthrough, OpenIddict
// has already validated the auth code / refresh token and stored the original
// auth principal on the AspNetCore authentication scheme - we just re-issue.
app.MapMethods("/connect/token", new[] { "POST" }, async (HttpContext context) =>
{
    var request = context.GetOpenIddictServerRequest()
        ?? throw new InvalidOperationException("OpenIddict request not present.");

    if (!request.IsAuthorizationCodeGrantType() && !request.IsRefreshTokenGrantType())
    {
        throw new InvalidOperationException("Unsupported grant type.");
    }

    var auth = await context.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);

    if (!auth.Succeeded || auth.Principal is null)
    {
        return Results.Forbid(
            authenticationSchemes: new[] { OpenIddictServerAspNetCoreDefaults.AuthenticationScheme },
            properties: new AuthenticationProperties(new Dictionary<string, string?>
            {
                [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidGrant,
                [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                    "The token is no longer valid.",
            }));
    }

    // Re-apply claim destinations so they appear on the freshly-minted tokens.
    auth.Principal.SetDestinations(static _ => new[] { Destinations.AccessToken, Destinations.IdentityToken });

    return Results.SignIn(
        auth.Principal,
        properties: null,
        authenticationScheme: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
});

// /api/me - returns the authenticated User's claims. Protected; 401 if no token.
app.MapGet("/api/me", (HttpContext ctx) =>
{
    return Results.Ok(new
    {
        name = ctx.User.Identity?.Name,
        email = ctx.User.FindFirst(Claims.Email)?.Value,
        isSiteAdmin = ctx.User.FindFirst("is_site_admin")?.Value == "true",
    });
}).RequireAuthorization("ApiUser");

// SPA fallback: any non-API, non-static-file request serves index.html so the
// React client-side router can handle it.
app.MapFallbackToFile("/index.html");

app.Run();

/// <summary>
/// Composition root for the RecordKeeping API. Declared as a partial class so the
/// integration test project can use it as the entry point for <c>WebApplicationFactory</c>.
/// </summary>
public partial class Program;
