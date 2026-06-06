using System.Security.Claims;
using Microsoft.AspNetCore; // for OpenIddictServerAspNetCoreHelpers extension methods
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol.AspNetCore.Authentication;
using OpenIddict.Abstractions;
using OpenIddict.Server;
using OpenIddict.Server.AspNetCore;
using OpenIddict.Validation.AspNetCore;
using RecordKeeping.Api;
using RecordKeeping.Api.Endpoints;
using RecordKeeping.Api.Realtime;
using RecordKeeping.Application.Reporting;
using RecordKeeping.Infrastructure.Identity;
using RecordKeeping.Infrastructure.Persistence;
using RecordKeeping.Infrastructure.Reporting;
using RecordKeeping.Mcp;
using RecordKeeping.Reporting;
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

// Domain persistence (dbo schema), separate from the auth schema above.
builder.Services.AddRecordKeepingPersistence(connectionString);

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

        options.RegisterScopes(Scopes.Email, Scopes.Profile, Scopes.OfflineAccess, AuthSeeder.McpScopeName);

        // Serve RFC 8414 metadata at the oauth-authorization-server path too (MCP clients probe it),
        // alongside the default OIDC discovery document.
        options.SetConfigurationEndpointUris("/.well-known/openid-configuration", "/.well-known/oauth-authorization-server");

        // MCP clients (RFC 8707) always send a `resource` parameter equal to the MCP server URL,
        // which is host-dynamic and not pre-registered. Two OpenIddict checks must be relaxed for
        // this, or the OAuth flow fails:
        //   - DisableResourceValidation: don't reject an unknown resource (ID2190 invalid_target).
        //   - IgnoreResourcePermissions: don't require the (dynamically-registered) client to hold
        //     a per-resource permission for it (ID2192). Clients can't pre-register a permission
        //     for a host they discover at connect time.
        // The MCP endpoint authorizes on the `mcp` scope instead; RS == AS makes that sufficient.
        // See docs/Architecture.md §MCP.
        options.DisableResourceValidation();
        options.IgnoreResourcePermissions();

        // Advertise the Dynamic Client Registration endpoint in discovery so agents self-register.
        options.AddEventHandler<OpenIddictServerEvents.HandleConfigurationRequestContext>(handler =>
            handler.UseInlineHandler(context =>
            {
                var httpRequest = context.Transaction.GetHttpRequest();
                if (httpRequest is not null)
                {
                    context.Metadata["registration_endpoint"] =
                        $"{httpRequest.Scheme}://{httpRequest.Host}{DynamicClientRegistration.EndpointPath}";
                }

                return default;
            }));

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

// MCP server (embedded): exposes tools to AI agents over Streamable HTTP. Acts as an OAuth
// resource server trusting tokens this same app issues. See docs/Architecture.md §MCP.
builder.Services.AddScoped<DynamicClientRegistration>();
builder.Services.AddRecordKeepingMcp();

// Report Engine: renders Report Templates (RDL) to PDF for the SiteAdmin-only builder preview.
builder.Services.AddRecordKeepingReporting();

// SignalR + the in-memory stores backing the live Report Template preview (ReportPreviewHub). Both are
// singletons so every hub connection shares the latest rendered frame and the live presence/locks per session.
builder.Services
    .AddSignalR()
    // camelCase hub payloads, matching the SPA's TypeScript models and the rest of the API's JSON.
    .AddJsonProtocol(options =>
        options.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);
builder.Services.AddSingleton<IReportPreviewSessions, InMemoryReportPreviewSessions>();
builder.Services.AddSingleton<IReportPreviewPresence, InMemoryReportPreviewPresence>();

// Serialize enums by name (e.g. "Decimal") so API payloads expose the Production Field DataType
// as a stable string rather than an integer.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

// The MCP authentication scheme publishes Protected Resource Metadata and the discovery
// challenge; it forwards actual token validation to the OpenIddict validation scheme.
builder.Services.AddAuthentication()
    .AddRecordKeepingMcpAuthentication(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);

// API endpoints use the OpenIddict validation scheme (challenges with 401),
// not Identity's cookie scheme (which would 302-redirect to a login page).
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ApiUser", new AuthorizationPolicyBuilder(
            OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build());

    // SiteAdmin-only endpoints (platform operators, I-D13): authenticated and carrying the
    // is_site_admin claim. Used by the Report Builder and the Production Field catalog mutations.
    options.AddPolicy("SiteAdmin", new AuthorizationPolicyBuilder(
            OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .RequireAssertion(context => context.User.IsSiteAdmin())
        .Build());

    // MCP tool calls require an authenticated caller whose token carries the `mcp` scope.
    // The challenge is issued by the MCP scheme (adds the resource_metadata pointer); token
    // validation is forwarded to OpenIddict. See I-D16.
    options.AddPolicy(McpEndpointExtensions.McpAuthorizationPolicy,
        new AuthorizationPolicyBuilder(McpAuthenticationDefaults.AuthenticationScheme)
            .RequireAuthenticatedUser()
            .RequireAssertion(context => context.User.HasScope(McpEndpointExtensions.McpScope))
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

    // Domain tables share the database with the auth schema; create them via the
    // initializer because EnsureCreated no-ops once the database already exists.
    var domainDb = scope.ServiceProvider.GetRequiredService<RecordKeepingDbContext>();
    await RecordKeepingDbInitializer.InitializeAsync(domainDb);

    // Seed the platform-global Production Field catalog (reference data, every environment) once the
    // domain schema exists. Idempotent: seeds only when the catalog is empty.
    await ProductionFieldSeeder.SeedAsync(scope.ServiceProvider);

    // Development-only sample data (a sample Org + Org User); a no-op outside Development.
    // Runs after the domain schema exists so the Org insert has a table to target.
    await AuthSeeder.SeedDevelopmentDataAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Honor X-Forwarded-* so OAuth/MCP discovery advertises the public host + scheme when the
// app runs behind a TLS-terminating proxy or tunnel (Azure Container Apps, cloudflared, ngrok).
// Without this, discovery would advertise the internal origin (e.g. localhost) and remote
// agents could not complete the OAuth flow. Must run before anything that reads scheme/host.
var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor
        | ForwardedHeaders.XForwardedProto
        | ForwardedHeaders.XForwardedHost,
};
// The proxy/tunnel source IP isn't known or stable in these environments, so don't filter by
// it. A production ingress with a fixed egress range should instead populate KnownProxies.
forwardedHeadersOptions.KnownNetworks.Clear();
forwardedHeadersOptions.KnownProxies.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);

app.UseHttpsRedirection();

// SPA static assets, then auth, then endpoints.
app.UseDefaultFiles();
app.UseStaticFiles();

// Browser WebSocket clients can't set the Authorization header on the SignalR handshake, so the
// client sends the access token in the access_token query string. Copy it into the Authorization
// header for hub requests before authentication runs (see HubQueryStringAuthentication).
app.Use(async (context, next) =>
{
    HubQueryStringAuthentication.ApplyAccessTokenFromQueryString(context, ReportPreviewHub.Path);
    await next();
});

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

    // Org Users carry their Org id so API endpoints can scope to it (I-D03); a SiteAdmin
    // has no Org (I-D13), so the claim is simply absent for them.
    if (user.OrgId is Guid orgId)
    {
        identity.SetClaim(ClaimsPrincipalExtensions.OrgIdClaimType, orgId.ToString());
    }

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

// Dynamic Client Registration (RFC 7591) — agents self-register here on first connect.
app.MapDynamicClientRegistration();

// MCP Streamable HTTP endpoint, protected by the McpUser policy.
app.MapRecordKeepingMcp();

// Live Report Template preview hub (SiteAdmin only). Editors push RDL; watchers receive rendered
// page images in near-real time. See docs/Architecture.md §In-house Reporting and ReportPreviewHub.
app.MapHub<ReportPreviewHub>(ReportPreviewHub.Path).RequireAuthorization(ReportPreviewHub.Policy);

// SPA fallback: any non-API, non-static-file request serves index.html so the
// React client-side router can handle it.
app.MapFallbackToFile("/index.html");
app.MapEndpoints(typeof(Program).Assembly);

app.Run();

/// <summary>
/// Composition root for the RecordKeeping API. Declared as a partial class so the
/// integration test project can use it as the entry point for <c>WebApplicationFactory</c>.
/// </summary>
public partial class Program;
