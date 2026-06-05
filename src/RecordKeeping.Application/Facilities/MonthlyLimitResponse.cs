using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>
/// Read model for a <see cref="MonthlyLimit"/> held by a Facility.
/// </summary>
/// <param name="EmissionType">The pollutant the limit constrains, e.g. <c>"VOC"</c>.</param>
/// <param name="Value">The cap, in tons per calendar month.</param>
public sealed record MonthlyLimitResponse(string EmissionType, double Value)
{
    /// <summary>Projects a domain <see cref="MonthlyLimit"/> into a <see cref="MonthlyLimitResponse"/>.</summary>
    /// <param name="limit">The Monthly Limit to project.</param>
    /// <returns>The response read model, with the Emission Type rendered as its name.</returns>
    public static MonthlyLimitResponse FromLimit(MonthlyLimit limit) =>
        new(limit.EmissionType.ToString(), limit.Value);
}
