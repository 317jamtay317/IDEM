using ErrorOr;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to remove a license from a Facility in the caller's Org.</summary>
/// <param name="OrgId">The caller's Org; scopes the Facility lookup (I-D03).</param>
/// <param name="FacilityId">The Facility to remove the license from.</param>
/// <param name="LicenseId">The license to remove.</param>
public sealed record RemoveLicenseCommand(Guid OrgId, Guid FacilityId, Guid LicenseId);

/// <summary>Handles <see cref="RemoveLicenseCommand"/>.</summary>
public static class RemoveLicenseHandler
{
    /// <summary>
    /// Removes a license from the caller's Facility. The Facility aggregate owns the rules that the
    /// license must exist and that a Facility must retain at least one license.
    /// </summary>
    /// <param name="command">The remove command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// <see cref="Result.Success"/>; a not-found error when the Facility is not in the caller's Org
    /// (I-D03) or the license does not exist; or a validation error when it is the only license.
    /// </returns>
    public static async Task<ErrorOr<Success>> Handle(
        RemoveLicenseCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        var result = facility.RemoveLicense(command.LicenseId);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
