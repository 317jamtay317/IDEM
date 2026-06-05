using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when a <see cref="MonthlyLimit"/> is removed from a <see cref="Facility"/>.
/// </summary>
/// <param name="FacilityId">The Facility the limit was removed from.</param>
/// <param name="EmissionType">The Emission Type whose limit was removed.</param>
public sealed record MonthlyLimitRemoved(Guid FacilityId, EmissionType EmissionType) : IDomainEvent;
