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

    /// <summary>
    /// Loads the Record with <paramref name="recordId"/> <b>only if</b> it belongs to
    /// <paramref name="orgId"/>; otherwise <c>null</c>. The Org scope enforces I-D03.
    /// </summary>
    /// <param name="orgId">The Org the Record must belong to.</param>
    /// <param name="recordId">The Record's unique identifier.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching Record with its values, or <c>null</c> when not found in that Org.</returns>
    Task<Record?> GetByIdAsync(Guid orgId, Guid recordId, CancellationToken cancellationToken);

    /// <summary>
    /// Loads the Records owned by <paramref name="orgId"/>, newest date first, optionally narrowed to a
    /// single Facility and/or a date range. The <paramref name="orgId"/> filter is applied at the query
    /// level so a caller can never read another Org's Records (I-D03).
    /// </summary>
    /// <param name="orgId">The owning Org's id; always applied.</param>
    /// <param name="facilityId">When set, restrict to this Facility; otherwise all of the Org's Facilities.</param>
    /// <param name="from">When set, include only Records on or after this date (inclusive).</param>
    /// <param name="to">When set, include only Records on or before this date (inclusive).</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching Records with their values, ordered by date descending; empty when none.</returns>
    Task<IReadOnlyList<Record>> GetByOrgAsync(
        Guid orgId, Guid? facilityId, DateOnly? from, DateOnly? to, CancellationToken cancellationToken);

    /// <summary>Persists all staged changes.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
