using ErrorOr;
using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// A per-calendar-month cap, in tons, on a <see cref="Facility"/>'s emission of a single
/// <see cref="EmissionType"/>. A Facility holds at most one Monthly Limit per Emission Type
/// (I-D19); the limit's tons <see cref="Value"/> can be changed via <see cref="Facility.UpdateLimit"/>.
/// </summary>
/// <remarks>
/// A value object: two Monthly Limits are equal when their <see cref="FacilityId"/>,
/// <see cref="EmissionType"/>, and <see cref="Value"/> match. "Editing" a limit produces a new
/// instance carrying the new value rather than mutating the existing one.
/// </remarks>
public sealed class MonthlyLimit : ValueObject
{
    private MonthlyLimit(Guid facilityId, EmissionType emissionType, double value)
    {
        FacilityId = facilityId;
        EmissionType = emissionType;
        Value = value;
    }

    /// <summary>The unique identifier of the Facility this limit applies to.</summary>
    public Guid FacilityId { get; private set; }

    /// <summary>The pollutant this limit constrains.</summary>
    public EmissionType EmissionType { get; private set; }

    /// <summary>The cap, in tons per calendar month. Always positive (I-D20).</summary>
    public double Value { get; private set; }

    /// <summary>
    /// Creates a Monthly Limit of <paramref name="tons"/> tons/month on <paramref name="emissionType"/>
    /// for the given Facility.
    /// </summary>
    /// <param name="facilityId">The owning Facility's id.</param>
    /// <param name="emissionType">The pollutant the limit constrains.</param>
    /// <param name="tons">The cap in tons per month; must be greater than zero (I-D20).</param>
    /// <returns>
    /// The new Monthly Limit, or <see cref="FacilityErrors.LimitValueMustBePositive"/> when
    /// <paramref name="tons"/> is not positive.
    /// </returns>
    public static ErrorOr<MonthlyLimit> Create(Guid facilityId, EmissionType emissionType, double tons)
    {
        // I-D20: a Monthly Limit's value must be a positive number of tons.
        if (tons <= 0)
        {
            return FacilityErrors.LimitValueMustBePositive;
        }

        return new MonthlyLimit(facilityId, emissionType, tons);
    }

    /// <inheritdoc/>
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return FacilityId;
        yield return EmissionType;
        yield return Value;
    }
}
