using Microsoft.EntityFrameworkCore;
using RecordKeeping.Application.Records;
using RecordKeeping.Domain.Records;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core-backed <see cref="IRecordRepository"/> over <see cref="RecordKeepingDbContext"/>. The
/// owned <c>Values</c> collection loads automatically with each Record.
/// </summary>
public sealed class RecordRepository(RecordKeepingDbContext dbContext) : IRecordRepository
{
    /// <inheritdoc />
    public async Task AddAsync(Record record, CancellationToken cancellationToken) =>
        await dbContext.Records.AddAsync(record, cancellationToken);

    /// <inheritdoc />
    public Task<Record?> GetByFacilityAndDateAsync(
        Guid orgId, Guid facilityId, DateOnly date, CancellationToken cancellationToken) =>
        dbContext.Records.FirstOrDefaultAsync(
            record => record.OrgId == orgId && record.FacilityId == facilityId && record.Date == date,
            cancellationToken);

    /// <inheritdoc />
    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
