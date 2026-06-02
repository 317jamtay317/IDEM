using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Raised when a <see cref="License"/> is added to a <see cref="Facility"/>.
/// </summary>
/// <param name="FacilityId">The Facility the license was added to.</param>
/// <param name="LicenseId">The license that was added.</param>
public sealed record LicenseAdded(Guid FacilityId, Guid LicenseId) : IDomainEvent;
