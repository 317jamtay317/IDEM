using ErrorOr;

namespace RecordKeeping.Application.Records;

/// <summary>
/// Application-level business-outcome errors for Record operations, surfaced as
/// <see cref="ErrorOr{T}"/> results rather than exceptions.
/// </summary>
public static class RecordErrors
{
    /// <summary>
    /// No Record with the given id exists within the caller's Org. Returned both when the id is unknown
    /// and when it belongs to another Org, so a caller cannot probe for Records outside their Org (I-D03).
    /// </summary>
    /// <param name="recordId">The Record id that could not be found in the caller's Org.</param>
    /// <returns>A not-found error.</returns>
    public static Error NotFound(Guid recordId) =>
        Error.NotFound("Record.NotFound", $"No Record with id '{recordId}' exists in this Org.");

    /// <summary>
    /// I-D23: the Facility already has a Record for the given date, and there may be at most one.
    /// </summary>
    /// <param name="facilityId">The Facility that already has a Record on the date.</param>
    /// <param name="date">The date already recorded.</param>
    /// <returns>A conflict error.</returns>
    public static Error DuplicateForDate(Guid facilityId, DateOnly date) =>
        Error.Conflict(
            "I-D23", $"A Record already exists for Facility '{facilityId}' on {date:yyyy-MM-dd}.");

    /// <summary>
    /// A value was supplied for a field that is not an active Production Field in the catalog (it does
    /// not exist or has been retired), so it cannot be recorded.
    /// </summary>
    /// <param name="propertyName">The field key that is not available.</param>
    /// <returns>A validation error.</returns>
    public static Error FieldNotAvailable(string propertyName) =>
        Error.Validation(
            "Record.FieldNotAvailable",
            $"'{propertyName}' is not an active Production Field and cannot be recorded.");
}
