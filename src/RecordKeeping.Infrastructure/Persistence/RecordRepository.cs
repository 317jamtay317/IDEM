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
    public async Task<Record?> GetByIdAsync(
        Guid orgId, Guid recordId, CancellationToken cancellationToken) =>
        await dbContext.Records.FirstOrDefaultAsync(
            record => record.OrgId == orgId && record.Id == recordId, cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<Record>> GetByOrgAsync(
        Guid orgId, Guid? facilityId, DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        // I-D03: the Org filter is applied first and always, so a caller can never reach another Org's
        // Records regardless of the optional filters below.
        var query = dbContext.Records.Where(record => record.OrgId == orgId);

        if (facilityId is { } facility)
        {
            query = query.Where(record => record.FacilityId == facility);
        }

        if (from is { } fromDate)
        {
            query = query.Where(record => record.Date >= fromDate);
        }

        if (to is { } toDate)
        {
            query = query.Where(record => record.Date <= toDate);
        }

        return await query.OrderByDescending(record => record.Date).ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
