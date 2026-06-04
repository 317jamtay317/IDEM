using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Application.Records;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// DI registration for the RecordKeeping domain persistence components.
/// </summary>
public static class PersistenceServiceCollectionExtensions
{
    /// <summary>
    /// Registers <see cref="RecordKeepingDbContext"/> and the domain repositories.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="connectionString">The SQL Server connection string.</param>
    /// <returns>The same <paramref name="services"/> for chaining.</returns>
    public static IServiceCollection AddRecordKeepingPersistence(
        this IServiceCollection services,
        string connectionString)
    {
        services.AddDbContext<RecordKeepingDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddScoped<IOrgRepository, OrgRepository>();
        services.AddScoped<IFacilityRepository, FacilityRepository>();
        services.AddScoped<IProductionFieldRepository, ProductionFieldRepository>();
        services.AddScoped<IRecordRepository, RecordRepository>();
        services.AddScoped<IProductionFieldLimitRepository, ProductionFieldLimitRepository>();

        return services;
    }
}
