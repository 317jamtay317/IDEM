using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>Command to remove a Facility from an Org.</summary>
/// <param name="OrgId">The Org that owns the Facility.</param>
/// <param name="FacilityId">The Facility to remove.</param>
public sealed record RemoveFacilityCommand(Guid OrgId, Guid FacilityId);

/// <summary>Handles <see cref="RemoveFacilityCommand"/>.</summary>
public static class RemoveFacilityHandler
{
    /// <summary>Removes the Facility through its owning Org aggregate.</summary>
    /// <param name="command">The remove command.</param>
    /// <param name="repository">The Org repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// <see cref="Result.Deleted"/> on success; <see cref="OrgErrors.NotFound"/> when the Org does
    /// not exist; or a not-found error when the Facility is not in the Org.
    /// </returns>
    public static async Task<ErrorOr<Deleted>> Handle(
        RemoveFacilityCommand command,
        IOrgRepository repository,
        CancellationToken cancellationToken)
    {
        var org = await repository.GetByIdAsync(command.OrgId, cancellationToken);
        if (org is null)
        {
            return OrgErrors.NotFound(command.OrgId);
        }

        var result = org.RemoveFacility(command.FacilityId);
        if (result.IsError)
        {
            return result.Errors;
        }

        await repository.SaveChangesAsync(cancellationToken);
        return Result.Deleted;
    }
}
