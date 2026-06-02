using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when a <see cref="License"/> is removed from a <see cref="Facility"/>.
/// </summary>
/// <param name="FacilityId">The Facility the license was removed from.</param>
/// <param name="LicenseId">The license that was removed.</param>
public sealed record LicenseRemoved(Guid FacilityId, Guid LicenseId) : IDomainEvent;