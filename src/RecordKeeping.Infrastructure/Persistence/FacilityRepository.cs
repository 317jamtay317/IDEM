using Microsoft.EntityFrameworkCore;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core-backed <see cref="IFacilityRepository"/> over <see cref="RecordKeepingDbContext"/>.
/// </summary>
public sealed class FacilityRepository(RecordKeepingDbContext dbContext) : IFacilityRepository
{
    /// <inheritdoc />
    public async Task AddAsync(Facility facility, CancellationToken cancellationToken) =>
        await dbContext.Facilities.AddAsync(facility, cancellationToken);

    /// <inheritdoc />
    public Task<Facility?> GetByIdAsync(Guid orgId, Guid facilityId, CancellationToken cancellationToken) =>
        dbContext.Facilities
            .FirstOrDefaultAsync(f => f.OrgId == orgId && f.Id == facilityId, cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<Facility>> GetByOrgAsync(Guid orgId, CancellationToken cancellationToken) =>
        await dbContext.Facilities
            .Where(f => f.OrgId == orgId)
            .ToListAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<Facility>> GetByOrgsAsync(
        IReadOnlyCollection<Guid> orgIds, CancellationToken cancellationToken) =>
        await dbContext.Facilities
            .Where(f => orgIds.Contains(f.OrgId))
            .ToListAsync(cancellationToken);

    /// <inheritdoc />
    public Task RemoveAsync(Facility facility, CancellationToken cancellationToken)
    {
        dbContext.Facilities.Remove(facility);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
