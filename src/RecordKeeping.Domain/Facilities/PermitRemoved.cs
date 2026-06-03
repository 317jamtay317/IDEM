using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when a <see cref="Permit"/> is removed from a <see cref="Facility"/>.
/// </summary>
/// <param name="FacilityId">The Facility the Permit was removed from.</param>
/// <param name="PermitId">The Permit that was removed.</param>
public sealed record PermitRemoved(Guid FacilityId, Guid PermitId) : IDomainEvent;
