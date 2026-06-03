using ErrorOr;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to add a license to a Facility in the caller's Org.</summary>
/// <param name="OrgId">The caller's Org; scopes the Facility lookup (I-D03).</param>
/// <param name="FacilityId">The Facility to add the license to.</param>
/// <param name="ExpirationDate">The license's expiration date; must not be in the past.</param>
/// <param name="Value">The license value/number.</param>
public sealed record AddLicenseCommand(Guid OrgId, Guid FacilityId, DateOnly ExpirationDate, string Value);

/// <summary>Handles <see cref="AddLicenseCommand"/>.</summary>
public static class AddLicenseHandler
{
    /// <summary>
    /// Adds a license to the caller's Facility. The Facility aggregate owns the rule that a license
    /// cannot already be expired.
    /// </summary>
    /// <param name="command">The add command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The added license as a <see cref="LicenseResponse"/>; a not-found error when the Facility is
    /// not in the caller's Org (I-D03); or a validation error when the license is already expired.
    /// </returns>
    public static async Task<ErrorOr<LicenseResponse>> Handle(
        AddLicenseCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        var license = License.Create(command.FacilityId, command.ExpirationDate, command.Value);
        var result = facility.AddLicense(license);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.SaveChangesAsync(cancellationToken);
        return LicenseResponse.FromLicense(license);
    }
}
