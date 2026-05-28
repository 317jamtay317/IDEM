var builder = WebApplication.CreateBuilder(args);

// OpenAPI metadata — endpoint documentation per Architecture.md.
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Serve the React SPA bundled into wwwroot by the BuildClient MSBuild target.
// UseDefaultFiles must precede UseStaticFiles so "/" resolves to index.html.
app.UseDefaultFiles();
app.UseStaticFiles();

// API endpoints will be mapped here as features land. Per Clean Architecture,
// endpoints delegate to Application-layer handlers and never contain business logic.

// SPA fallback: any non-API, non-static-file request serves index.html so the
// React client-side router can handle it.
app.MapFallbackToFile("/index.html");

app.Run();

/// <summary>
/// Composition root for the RecordKeeping API. Declared as a partial class so the
/// integration test project can use it as the entry point for <c>WebApplicationFactory</c>.
/// </summary>
public partial class Program;
