using RecordKeeping.Domain.Records;

namespace RecordKeeping.Application.Records;

/// <summary>
/// Persistence gateway for the <see cref="Record"/> aggregate. Implemented in the Infrastructure
/// layer; the Application layer depends only on this contract.
/// </summary>
/// <remarks>
/// Reads are scoped by <c>orgId</c> so a caller can never load another Org's Record (I-D03).
/// </remarks>
public interface IRecordRepository
{
    /// <summary>Stages a newly created <paramref name="record"/> for insertion.</summary>
    /// <param name="record">The Record to add.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task AddAsync(Record record, CancellationToken cancellationToken);

    /// <summary>
    /// Loads the Record for <paramref name="facilityId"/> on <paramref name="date"/> within
    /// <paramref name="orgId"/>, or <c>null</c> if none exists. Used to enforce the one-Record-per-
    /// Facility-per-date rule (I-D23); the Org scope keeps the lookup within the caller's Org (I-D03).
    /// </summary>
    /// <param name="orgId">The Org the Record must belong to.</param>
    /// <param name="facilityId">The Facility the Record is for.</param>
    /// <param name="date">The date the Record covers.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching Record, or <c>null</c>.</returns>
    Task<Record?> GetByFacilityAndDateAsync(
        Guid orgId, Guid facilityId, DateOnly date, CancellationToken cancellationToken);

    /// <summary>Persists all staged changes.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
