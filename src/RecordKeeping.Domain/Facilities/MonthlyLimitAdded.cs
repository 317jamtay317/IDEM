using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when a <see cref="MonthlyLimit"/> is added to a <see cref="Facility"/>.
/// </summary>
/// <param name="FacilityId">The Facility the limit was added to.</param>
/// <param name="EmissionType">The Emission Type the limit constrains.</param>
public sealed record MonthlyLimitAdded(Guid FacilityId, EmissionType EmissionType) : IDomainEvent;
