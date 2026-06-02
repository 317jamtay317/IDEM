using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>Command to add a new Facility to an Org (I-D06).</summary>
/// <param name="OrgId">The Org that will own the Facility.</param>
/// <param name="Name">The Facility's name; required, trimmed, length-capped.</param>
public sealed record AddFacilityCommand(Guid OrgId, string Name);

/// <summary>Handles <see cref="AddFacilityCommand"/>.</summary>
public static class AddFacilityHandler
{
    /// <summary>Adds a Facility to the Org, letting the aggregate own the invariant (I-D06).</summary>
    /// <param name="command">The add command.</param>
    /// <param name="repository">The Org repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The created Facility as a <see cref="FacilityResponse"/>; <see cref="OrgErrors.NotFound"/>
    /// when the Org does not exist; or a validation error when the name is invalid.
    /// </returns>
    public static async Task<ErrorOr<FacilityResponse>> Handle(
        AddFacilityCommand command,
        IOrgRepository repository,
        CancellationToken cancellationToken)
    {
        var org = await repository.GetByIdAsync(command.OrgId, cancellationToken);
        if (org is null)
        {
            return OrgErrors.NotFound(command.OrgId);
        }

        var result = org.AddFacility(command.Name);
        if (result.IsError)
        {
            return result.Errors;
        }

        await repository.SaveChangesAsync(cancellationToken);
        return FacilityResponse.FromFacility(result.Value);
    }
}
