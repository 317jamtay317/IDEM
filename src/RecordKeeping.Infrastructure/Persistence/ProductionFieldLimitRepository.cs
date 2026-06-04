using Microsoft.EntityFrameworkCore;
using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFieldLimits;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core-backed <see cref="IProductionFieldLimitRepository"/> over
/// <see cref="RecordKeepingDbContext"/>. Reads are Org-scoped (I-D03).
/// </summary>
public sealed class ProductionFieldLimitRepository(RecordKeepingDbContext dbContext)
    : IProductionFieldLimitRepository
{
    /// <inheritdoc />
    public async Task AddAsync(ProductionFieldLimit limit, CancellationToken cancellationToken) =>
        await dbContext.ProductionFieldLimits.AddAsync(limit, cancellationToken);

    /// <inheritdoc />
    public Task<ProductionFieldLimit?> GetByPropertyAsync(
        Guid orgId, string propertyName, CancellationToken cancellationToken) =>
        // The SQL Server default collation is case-insensitive, matching the catalog's PropertyName key.
        dbContext.ProductionFieldLimits.FirstOrDefaultAsync(
            limit => limit.OrgId == orgId && limit.PropertyName == propertyName, cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<ProductionFieldLimit>> GetByOrgAsync(
        Guid orgId, CancellationToken cancellationToken) =>
        // I-D03: the Org filter is applied at the query level, always.
        await dbContext.ProductionFieldLimits
            .Where(limit => limit.OrgId == orgId)
            .ToListAsync(cancellationToken);

    /// <inheritdoc />
    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
