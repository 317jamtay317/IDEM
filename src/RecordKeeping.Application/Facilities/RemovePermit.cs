using ErrorOr;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to remove a Permit from a Facility in the caller's Org.</summary>
/// <param name="OrgId">The caller's Org; scopes the Facility lookup (I-D03).</param>
/// <param name="FacilityId">The Facility to remove the Permit from.</param>
/// <param name="PermitId">The Permit to remove.</param>
public sealed record RemovePermitCommand(Guid OrgId, Guid FacilityId, Guid PermitId);

/// <summary>Handles <see cref="RemovePermitCommand"/>.</summary>
public static class RemovePermitHandler
{
    /// <summary>
    /// Removes a Permit from the caller's Facility. The Facility aggregate owns the rules that the
    /// Permit must exist and that a Facility must retain at least one Permit (I-D18).
    /// </summary>
    /// <param name="command">The remove command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// <see cref="Result.Success"/>; a not-found error when the Facility is not in the caller's Org
    /// (I-D03) or the Permit does not exist; or a validation error when it is the only Permit (I-D18).
    /// </returns>
    public static async Task<ErrorOr<Success>> Handle(
        RemovePermitCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        var result = facility.RemovePermit(command.PermitId);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
