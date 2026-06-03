using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when a <see cref="Permit"/> is added to a <see cref="Facility"/>.
/// </summary>
/// <param name="FacilityId">The Facility the Permit was added to.</param>
/// <param name="PermitId">The Permit that was added.</param>
public sealed record PermitAdded(Guid FacilityId, Guid PermitId) : IDomainEvent;
