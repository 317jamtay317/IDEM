using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when a User's access to a <see cref="Facility"/> is revoked via <see cref="Facility.RemoveUser"/>.
/// </summary>
/// <param name="FacilityId">The Facility the user was removed from.</param>
/// <param name="UserId">The user that was removed.</param>
public sealed record UserRemovedFromFacility(Guid FacilityId, Guid UserId) : IDomainEvent;
