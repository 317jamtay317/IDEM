using ErrorOr;

namespace RecordKeeping.Application.Records;

/// <summary>
/// Query for the Records owned by an Org, optionally narrowed to a single Facility and/or a date range
/// (the read side of "Log a Record"). The Org scope is always applied so the result can never include
/// another Org's Records (I-D03).
/// </summary>
/// <param name="OrgId">The Org whose Records to list.</param>
/// <param name="FacilityId">When set, restrict to this Facility; otherwise all of the Org's Facilities.</param>
/// <param name="From">When set, include only Records on or after this date (inclusive).</param>
/// <param name="To">When set, include only Records on or before this date (inclusive).</param>
public sealed record GetRecordsQuery(
    Guid OrgId,
    Guid? FacilityId = null,
    DateOnly? From = null,
    DateOnly? To = null);

/// <summary>Handles <see cref="GetRecordsQuery"/>.</summary>
public static class GetRecordsHandler
{
    /// <summary>
    /// Returns the Org's Records as read models, newest date first and scoped to that Org (I-D03),
    /// applying the optional Facility and date-range filters.
    /// </summary>
    /// <param name="query">The query carrying the Org id and optional filters.</param>
    /// <param name="records">The Record repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching Records as <see cref="RecordResponse"/> values; empty when there are none.</returns>
    public static async Task<ErrorOr<IReadOnlyList<RecordResponse>>> Handle(
        GetRecordsQuery query,
        IRecordRepository records,
        CancellationToken cancellationToken)
    {
        var found = await records.GetByOrgAsync(
            query.OrgId, query.FacilityId, query.From, query.To, cancellationToken);
        IReadOnlyList<RecordResponse> responses = found.Select(RecordResponse.FromRecord).ToList();
        return responses.ToErrorOr();
    }
}
