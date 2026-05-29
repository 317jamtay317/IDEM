using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.MsSql;

namespace RecordKeeping.Api.IntegrationTests;

/// <summary>
/// Per-test-assembly fixture: spins up a SQL Server container via Testcontainers
/// and points the API at it via the <c>ConnectionStrings__RecordKeeping</c>
/// environment variable (read by <c>WebApplication.CreateBuilder</c> before
/// <c>Program.cs</c> queries it).
/// </summary>
public sealed class RecordKeepingApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string ConnectionStringEnvVar = "ConnectionStrings__RecordKeeping";

    private readonly MsSqlContainer _sqlContainer =
        new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest")
            .Build();

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
    }

    /// <inheritdoc />
    public async Task InitializeAsync()
    {
        await _sqlContainer.StartAsync();

        // Env var must be set before any test calls CreateClient(), which is
        // when the host is built and Program.cs reads configuration. xUnit
        // guarantees InitializeAsync runs before any test method.
        Environment.SetEnvironmentVariable(
            ConnectionStringEnvVar,
            _sqlContainer.GetConnectionString());
    }

    /// <inheritdoc />
    async Task IAsyncLifetime.DisposeAsync()
    {
        Environment.SetEnvironmentVariable(ConnectionStringEnvVar, null);
        await _sqlContainer.DisposeAsync();
        await base.DisposeAsync();
    }
}
