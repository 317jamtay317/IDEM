using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>
/// Business-outcome errors for Facility operations, surfaced as <see cref="ErrorOr{T}"/>
/// results rather than exceptions.
/// </summary>
public static class FacilityErrors
{
    /// <summary>
    /// No Facility with the requested id exists in the caller's Org. A Facility that belongs to
    /// another Org is reported as not found too, never as forbidden (I-D03).
    /// </summary>
    /// <param name="id">The Facility id that was not found.</param>
    /// <returns>A not-found error.</returns>
    public static Error NotFound(Guid id) =>
        Error.NotFound("Facility.NotFound", $"No Facility exists with id '{id}'.");
}
