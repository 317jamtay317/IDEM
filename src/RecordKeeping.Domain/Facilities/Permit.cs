using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// A regulatory authorization a <see cref="Facility"/> holds in order to operate — for asphalt
/// plants, the air-emission permit issued by its Regulator (MDEQ / IDEM). A Permit carries an
/// <see cref="ExpirationDate"/> and a <see cref="Value"/> (the permit number).
/// </summary>
/// <remarks>
/// A Permit has its own identity, but two Permits are treated as equal when they share the same
/// <see cref="Value"/> (see <see cref="Equals(Permit?)"/>).
/// </remarks>
public sealed class Permit(Guid id, Guid facilityId, DateOnly expirationDate, string value)
    : Entity<Guid>(id), IEquatable<Permit>
{
    /// <summary>
    /// Gets the unique identifier of the Facility this Permit is issued for. Assigned at creation
    /// and never changed thereafter.
    /// </summary>
    public Guid FacilityId { get; private set; } = facilityId;

    /// <summary>
    /// Gets the date the Permit expires. Inclusive: the Permit is still in force on this date.
    /// </summary>
    public DateOnly ExpirationDate { get; private set; } = expirationDate;

    /// <summary>
    /// Gets the Permit's value — the permit number / identifier carried on it.
    /// </summary>
    public string Value { get; private set; } = value;

    /// <summary>
    /// Creates a Permit for the given Facility.
    /// </summary>
    /// <param name="facilityId">The owning Facility's id.</param>
    /// <param name="expirationDate">The date the Permit expires (inclusive).</param>
    /// <param name="permitValue">The permit number / identifier.</param>
    /// <param name="id">An explicit id to assign; a new one is generated when omitted.</param>
    /// <returns>The new Permit.</returns>
    public static Permit Create(Guid facilityId, DateOnly expirationDate, string permitValue, Guid? id = null) =>
        new(id ?? Guid.NewGuid(), facilityId, expirationDate, permitValue);

    /// <summary>
    /// Determines whether this Permit equals <paramref name="other"/> by <see cref="Value"/>.
    /// </summary>
    /// <param name="other">The Permit to compare with.</param>
    /// <returns><see langword="true"/> when both Permits carry the same <see cref="Value"/>.</returns>
    public bool Equals(Permit? other) => other is not null && Value == other.Value;
}
