using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>Command to remove a Facility from an Org.</summary>
/// <param name="OrgId">The Org that owns the Facility.</param>
/// <param name="FacilityId">The Facility to remove.</param>
public sealed record RemoveFacilityCommand(Guid OrgId, Guid FacilityId);

/// <summary>Handles <see cref="RemoveFacilityCommand"/>.</summary>
public static class RemoveFacilityHandler
{
    /// <summary>Removes the Facility, scoping the lookup to the caller's Org (I-D03).</summary>
    /// <param name="command">The remove command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// <see cref="Result.Deleted"/> on success, or <see cref="FacilityErrors.NotFound"/> when the
    /// Facility is not in the caller's Org.
    /// </returns>
    public static async Task<ErrorOr<Deleted>> Handle(
        RemoveFacilityCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(
            command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        await facilities.RemoveAsync(facility, cancellationToken);
        await facilities.SaveChangesAsync(cancellationToken);
        return Result.Deleted;
    }
}
