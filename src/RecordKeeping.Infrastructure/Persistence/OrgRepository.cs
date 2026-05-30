using Microsoft.EntityFrameworkCore;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core-backed <see cref="IOrgRepository"/> over <see cref="RecordKeepingDbContext"/>.
/// </summary>
public sealed class OrgRepository(RecordKeepingDbContext dbContext) : IOrgRepository
{
    /// <inheritdoc />
    public async Task AddAsync(Org org, CancellationToken cancellationToken) =>
        await dbContext.Orgs.AddAsync(org, cancellationToken);

    /// <inheritdoc />
    public Task<Org?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Orgs
            .Include(o => o.Facilities)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<Org>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.Orgs
            .Include(o => o.Facilities)
            .ToListAsync(cancellationToken);

    /// <inheritdoc />
    public Task RemoveAsync(Org org, CancellationToken cancellationToken)
    {
        dbContext.Orgs.Remove(org);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
