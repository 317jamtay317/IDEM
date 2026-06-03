using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>
/// Read model for a <see cref="License"/> held by a Facility.
/// </summary>
/// <param name="Id">The license's unique identifier.</param>
/// <param name="ExpirationDate">The date the license expires (inclusive).</param>
/// <param name="Value">The license value/number.</param>
public sealed record LicenseResponse(Guid Id, DateOnly ExpirationDate, string Value)
{
    /// <summary>Projects a domain <see cref="License"/> into a <see cref="LicenseResponse"/>.</summary>
    /// <param name="license">The license to project.</param>
    /// <returns>The response read model.</returns>
    public static LicenseResponse FromLicense(License license) =>
        new(license.Id, license.ExpirationDate, license.Value);
}
