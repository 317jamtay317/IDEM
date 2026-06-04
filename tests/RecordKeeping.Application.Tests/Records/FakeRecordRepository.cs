using RecordKeeping.Application.Records;
using DomainRecord = RecordKeeping.Domain.Records.Record;

namespace RecordKeeping.Application.Tests.Records;

/// <summary>
/// In-memory <see cref="IRecordRepository"/> test double. Reads are Org-scoped exactly as the real
/// repository is (I-D03), so cross-Org lookups return nothing. Tracks save calls so tests can assert
/// persistence was requested.
/// </summary>
internal sealed class FakeRecordRepository : IRecordRepository
{
    private readonly List<DomainRecord> _records = [];

    public int SaveChangesCount { get; private set; }

    public IReadOnlyList<DomainRecord> Stored => _records;

    public void Seed(DomainRecord record) => _records.Add(record);

    public Task AddAsync(DomainRecord record, CancellationToken cancellationToken)
    {
        _records.Add(record);
        return Task.CompletedTask;
    }

    public Task<DomainRecord?> GetByFacilityAndDateAsync(
        Guid orgId, Guid facilityId, DateOnly date, CancellationToken cancellationToken) =>
        Task.FromResult(_records.FirstOrDefault(r =>
            r.OrgId == orgId && r.FacilityId == facilityId && r.Date == date));

    public Task<DomainRecord?> GetByIdAsync(
        Guid orgId, Guid recordId, CancellationToken cancellationToken) =>
        Task.FromResult(_records.FirstOrDefault(r => r.OrgId == orgId && r.Id == recordId));

    public Task<IReadOnlyList<DomainRecord>> GetByOrgAsync(
        Guid orgId, Guid? facilityId, DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        IReadOnlyList<DomainRecord> result = _records
            .Where(r => r.OrgId == orgId)
            .Where(r => facilityId is null || r.FacilityId == facilityId)
            .Where(r => from is null || r.Date >= from)
            .Where(r => to is null || r.Date <= to)
            .OrderByDescending(r => r.Date)
            .ToList();
        return Task.FromResult(result);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveChangesCount++;
        return Task.CompletedTask;
    }
}
