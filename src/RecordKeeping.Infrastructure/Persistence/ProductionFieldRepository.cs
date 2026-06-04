using Microsoft.EntityFrameworkCore;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core-backed <see cref="IProductionFieldRepository"/> over <see cref="RecordKeepingDbContext"/>.
/// String comparisons rely on the database's case-insensitive collation, matching the catalog's
/// case-insensitive uniqueness rules (I-D21, I-D22).
/// </summary>
public sealed class ProductionFieldRepository(RecordKeepingDbContext dbContext) : IProductionFieldRepository
{
    /// <inheritdoc />
    public async Task AddAsync(ProductionField field, CancellationToken cancellationToken) =>
        await dbContext.ProductionFields.AddAsync(field, cancellationToken);

    /// <inheritdoc />
    public Task<ProductionField?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.ProductionFields.FirstOrDefaultAsync(field => field.Id == id, cancellationToken);

    /// <inheritdoc />
    public Task<ProductionField?> GetByPropertyNameAsync(string propertyName, CancellationToken cancellationToken) =>
        dbContext.ProductionFields.FirstOrDefaultAsync(
            field => field.PropertyName == propertyName, cancellationToken);

    /// <inheritdoc />
    public Task<ProductionField?> GetActiveByFriendlyNameAsync(string friendlyName, CancellationToken cancellationToken) =>
        dbContext.ProductionFields.FirstOrDefaultAsync(
            field => field.IsActive && field.FriendlyName == friendlyName, cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<ProductionField>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.ProductionFields.ToListAsync(cancellationToken);

    /// <inheritdoc />
    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
