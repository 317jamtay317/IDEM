using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using OpenIddict.Validation.AspNetCore;
using RecordKeeping.Infrastructure.Identity;

var builder = WebApplication.CreateBuilder(args);

// --- Configuration -----------------------------------------------------------

var connectionString = builder.Configuration.GetConnectionString("RecordKeeping")
    ?? throw new InvalidOperationException("ConnectionStrings:RecordKeeping is required.");

// --- Services ----------------------------------------------------------------

// OpenAPI metadata — endpoint documentation per Architecture.md.
builder.Services.AddOpenApi();

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

        options.RegisterScopes(
            OpenIddictConstants.Scopes.Email,
            OpenIddictConstants.Scopes.Profile,
            OpenIddictConstants.Scopes.OfflineAccess);

        // Dev/test ephemeral keys. Production replaces with persistent certs.
        options.AddEphemeralEncryptionKey()
            .AddEphemeralSigningKey();

        options.UseAspNetCore()
            .EnableAuthorizationEndpointPassthrough()
            .EnableTokenEndpointPassthrough()
            .EnableEndSessionEndpointPassthrough()
            .EnableUserInfoEndpointPassthrough()
            .EnableStatusCodePagesIntegration();

        options.SetAccessTokenLifetime(TimeSpan.FromMinutes(15));
        options.SetRefreshTokenLifetime(TimeSpan.FromDays(7));
    })
    .AddValidation(options =>
    {
        // Validate tokens issued by this same server (no external issuer).
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

// Initialize the auth schema on startup. EnsureCreated is acceptable pre-launch;
// migrate to EF migrations once the schema stabilizes.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    await db.Database.EnsureCreatedAsync();
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

// /api/me — returns the authenticated User's claims. Protected; 401 if no token.
app.MapGet("/api/me", (HttpContext ctx) =>
{
    return Results.Ok(new
    {
        name = ctx.User.Identity?.Name,
        email = ctx.User.FindFirst(OpenIddictConstants.Claims.Email)?.Value,
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
