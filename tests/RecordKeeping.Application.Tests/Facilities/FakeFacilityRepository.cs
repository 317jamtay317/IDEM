using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Tests.Facilities;

/// <summary>
/// In-memory <see cref="IFacilityRepository"/> test double. Reads are Org-scoped exactly as the
/// real repository is (I-D03), so cross-Org lookups return nothing. Tracks save calls so tests
/// can assert persistence was requested.
/// </summary>
internal sealed class FakeFacilityRepository : IFacilityRepository
{
    private readonly List<Facility> _facilities = [];

    public int SaveChangesCount { get; private set; }

    public IReadOnlyList<Facility> Stored => _facilities;

    public void Seed(Facility facility) => _facilities.Add(facility);

    public Task AddAsync(Facility facility, CancellationToken cancellationToken)
    {
        _facilities.Add(facility);
        return Task.CompletedTask;
    }

    public Task<Facility?> GetByIdAsync(Guid orgId, Guid facilityId, CancellationToken cancellationToken) =>
        Task.FromResult(_facilities.FirstOrDefault(f => f.OrgId == orgId && f.Id == facilityId));

    public Task<IReadOnlyList<Facility>> GetByOrgAsync(Guid orgId, CancellationToken cancellationToken) =>
        Task.FromResult((IReadOnlyList<Facility>)_facilities.Where(f => f.OrgId == orgId).ToList());

    public Task<IReadOnlyList<Facility>> GetByOrgsAsync(
        IReadOnlyCollection<Guid> orgIds, CancellationToken cancellationToken) =>
        Task.FromResult((IReadOnlyList<Facility>)_facilities.Where(f => orgIds.Contains(f.OrgId)).ToList());

    public Task RemoveAsync(Facility facility, CancellationToken cancellationToken)
    {
        _facilities.Remove(facility);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveChangesCount++;
        return Task.CompletedTask;
    }
}
