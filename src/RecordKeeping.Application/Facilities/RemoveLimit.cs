using ErrorOr;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to remove a Monthly Limit from a Facility in the caller's Org.</summary>
/// <param name="OrgId">The caller's Org; scopes the Facility lookup (I-D03).</param>
/// <param name="FacilityId">The Facility to remove the limit from.</param>
/// <param name="EmissionType">The Emission Type whose limit to remove.</param>
public sealed record RemoveLimitCommand(Guid OrgId, Guid FacilityId, EmissionType EmissionType);

/// <summary>Handles <see cref="RemoveLimitCommand"/>.</summary>
public static class RemoveLimitHandler
{
    /// <summary>
    /// Removes a Monthly Limit from the caller's Facility. The Facility aggregate owns the rule that
    /// the limit must exist for the given Emission Type.
    /// </summary>
    /// <param name="command">The remove command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// <see cref="Result.Success"/>; or a not-found error when the Facility is not in the caller's Org
    /// (I-D03) or holds no limit for the Emission Type.
    /// </returns>
    public static async Task<ErrorOr<Success>> Handle(
        RemoveLimitCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        var result = facility.RemoveLimit(command.EmissionType);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
