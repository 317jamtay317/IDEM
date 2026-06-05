using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Application.ProductionFields;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// Idempotent startup seeder for the Production Field catalog. Seeds the legacy field set
/// (<see cref="ProductionFieldSeedData"/>) only when the catalog is empty, so it is safe to run on
/// every startup and never overwrites a SiteAdmin's edits. Reference data, so it runs in every
/// environment (unlike the Development-only sample Org/User).
/// </summary>
public static class ProductionFieldSeeder
{
    /// <summary>Seeds the Production Field catalog if it is currently empty.</summary>
    /// <param name="services">A scoped service provider.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        var repository = services.GetRequiredService<IProductionFieldRepository>();

        var existing = await repository.GetAllAsync(cancellationToken);
        if (existing.Count > 0)
        {
            return;
        }

        foreach (var field in ProductionFieldSeedData.Create())
        {
            await repository.AddAsync(field, cancellationToken);
        }

        await repository.SaveChangesAsync(cancellationToken);
    }
}
