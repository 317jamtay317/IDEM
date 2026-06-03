using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to add a new Facility to an Org (I-D06).</summary>
/// <param name="OrgId">The Org that will own the Facility.</param>
/// <param name="Name">The Facility's name; required, trimmed, length-capped.</param>
public sealed record AddFacilityCommand(Guid OrgId, string Name);

/// <summary>Handles <see cref="AddFacilityCommand"/>.</summary>
public static class AddFacilityHandler
{
    /// <summary>
    /// Creates a Facility owned by the Org. The Facility aggregate owns the invariant (I-D06);
    /// the Org is checked for existence first so a Facility is never orphaned.
    /// </summary>
    /// <param name="command">The add command.</param>
    /// <param name="orgs">The Org repository, used to confirm the owning Org exists.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The created Facility as a <see cref="FacilityResponse"/>; <see cref="OrgErrors.NotFound"/>
    /// when the Org does not exist; or a validation error when the name is invalid.
    /// </returns>
    public static async Task<ErrorOr<FacilityResponse>> Handle(
        AddFacilityCommand command,
        IOrgRepository orgs,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var org = await orgs.GetByIdAsync(command.OrgId, cancellationToken);
        if (org is null)
        {
            return OrgErrors.NotFound(command.OrgId);
        }

        var result = Facility.Create(command.OrgId, command.Name);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.AddAsync(result.Value, cancellationToken);
        await facilities.SaveChangesAsync(cancellationToken);
        return FacilityResponse.FromFacility(result.Value);
    }
}
