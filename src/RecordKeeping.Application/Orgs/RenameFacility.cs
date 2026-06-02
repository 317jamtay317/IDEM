using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>Command to rename a Facility owned by an Org.</summary>
/// <param name="OrgId">The Org that owns the Facility.</param>
/// <param name="FacilityId">The Facility to rename.</param>
/// <param name="Name">The Facility's new name; required, trimmed, length-capped.</param>
public sealed record RenameFacilityCommand(Guid OrgId, Guid FacilityId, string Name);

/// <summary>Handles <see cref="RenameFacilityCommand"/>.</summary>
public static class RenameFacilityHandler
{
    /// <summary>Renames the Facility through its owning Org aggregate.</summary>
    /// <param name="command">The rename command.</param>
    /// <param name="repository">The Org repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The renamed Facility as a <see cref="FacilityResponse"/>; <see cref="OrgErrors.NotFound"/>
    /// when the Org does not exist; a not-found error when the Facility is not in the Org; or a
    /// validation error when the name is invalid.
    /// </returns>
    public static async Task<ErrorOr<FacilityResponse>> Handle(
        RenameFacilityCommand command,
        IOrgRepository repository,
        CancellationToken cancellationToken)
    {
        var org = await repository.GetByIdAsync(command.OrgId, cancellationToken);
        if (org is null)
        {
            return OrgErrors.NotFound(command.OrgId);
        }

        var result = org.RenameFacility(command.FacilityId, command.Name);
        if (result.IsError)
        {
            return result.Errors;
        }

        await repository.SaveChangesAsync(cancellationToken);
        return FacilityResponse.FromFacility(result.Value);
    }
}
