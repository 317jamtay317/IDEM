using ErrorOr;
using RecordKeeping.Application.Orgs;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to rename a Facility owned by an Org.</summary>
/// <param name="OrgId">The Org that owns the Facility.</param>
/// <param name="FacilityId">The Facility to rename.</param>
/// <param name="Name">The Facility's new name; required, trimmed, length-capped.</param>
public sealed record RenameFacilityCommand(Guid OrgId, Guid FacilityId, string Name);

/// <summary>Handles <see cref="RenameFacilityCommand"/>.</summary>
public static class RenameFacilityHandler
{
    /// <summary>Renames the Facility, scoping the lookup to the caller's Org (I-D03).</summary>
    /// <param name="command">The rename command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The renamed Facility as a <see cref="FacilityResponse"/>; <see cref="FacilityErrors.NotFound"/>
    /// when the Facility is not in the caller's Org; or a validation error when the name is invalid.
    /// </returns>
    public static async Task<ErrorOr<FacilityResponse>> Handle(
        RenameFacilityCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(
            command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        var result = facility.Rename(command.Name);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.SaveChangesAsync(cancellationToken);
        return FacilityResponse.FromFacility(facility);
    }
}
