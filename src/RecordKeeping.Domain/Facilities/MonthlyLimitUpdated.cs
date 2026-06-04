using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when the value of a <see cref="MonthlyLimit"/> on a <see cref="Facility"/> is changed.
/// </summary>
/// <param name="FacilityId">The Facility whose limit changed.</param>
/// <param name="EmissionType">The Emission Type whose limit value changed.</param>
public sealed record MonthlyLimitUpdated(Guid FacilityId, EmissionType EmissionType) : IDomainEvent;
