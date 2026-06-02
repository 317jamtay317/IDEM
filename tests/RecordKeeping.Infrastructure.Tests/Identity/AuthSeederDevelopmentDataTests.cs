using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using RecordKeeping.Infrastructure.Identity;
using Shouldly;

namespace RecordKeeping.Infrastructure.Tests.Identity;

/// <summary>
/// Unit tests for the Development gate on <see cref="AuthSeeder.SeedDevelopmentDataAsync"/>.
/// The sample Org and Org User must be seeded only when the host runs in the Development
/// environment; in every other environment the call is a no-op.
/// </summary>
public class AuthSeederDevelopmentDataTests
{
    [Theory]
    [InlineData("Production")]
    [InlineData("Testing")]
    [InlineData("Staging")]
    public async Task SeedDevelopmentDataAsync_OutsideDevelopment_SeedsNothing(string environment)
    {
        // The provider knows only the (non-Development) environment. The seeding dependencies
        // (UserManager, IOrgRepository) are deliberately NOT registered: if the gate is honored
        // the method returns before resolving them, so no exception is thrown. A regressed gate
        // would resolve the missing services and throw from GetRequiredService.
        var services = new ServiceCollection()
            .AddSingleton<IHostEnvironment>(new StubHostEnvironment(environment))
            .BuildServiceProvider();

        var exception = await Record.ExceptionAsync(
            () => AuthSeeder.SeedDevelopmentDataAsync(services));

        exception.ShouldBeNull();
    }

    private sealed class StubHostEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = "RecordKeeping.Infrastructure.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
