using ErrorOr;

namespace RecordKeeping.Application.Records;

/// <summary>Query for a single Record by id within an Org.</summary>
/// <param name="OrgId">The Org the Record must belong to (I-D03).</param>
/// <param name="RecordId">The Record's unique identifier.</param>
public sealed record GetRecordQuery(Guid OrgId, Guid RecordId);

/// <summary>Handles <see cref="GetRecordQuery"/>.</summary>
public static class GetRecordHandler
{
    /// <summary>
    /// Returns the Record as a read model, scoped to the caller's Org (I-D03). A Record that does not
    /// exist <em>or</em> belongs to another Org is reported as not found, so a caller cannot probe for
    /// Records outside their Org.
    /// </summary>
    /// <param name="query">The query carrying the Org id and the Record id.</param>
    /// <param name="records">The Record repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The Record as a <see cref="RecordResponse"/>, or <see cref="RecordErrors.NotFound"/> when no such
    /// Record exists within the caller's Org.
    /// </returns>
    public static async Task<ErrorOr<RecordResponse>> Handle(
        GetRecordQuery query,
        IRecordRepository records,
        CancellationToken cancellationToken)
    {
        var record = await records.GetByIdAsync(query.OrgId, query.RecordId, cancellationToken);
        if (record is null)
        {
            return RecordErrors.NotFound(query.RecordId);
        }

        return RecordResponse.FromRecord(record);
    }
}
