using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when a User is granted access to a <see cref="Facility"/> via <see cref="Facility.AddUser"/>.
/// </summary>
/// <param name="FacilityId">The Facility the user was added to.</param>
/// <param name="UserId">The user that was added.</param>
public sealed record UserAddedToFacility(Guid FacilityId, Guid UserId) : IDomainEvent;
