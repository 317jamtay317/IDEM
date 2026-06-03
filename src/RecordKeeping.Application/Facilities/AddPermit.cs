using ErrorOr;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to add a Permit to a Facility in the caller's Org.</summary>
/// <param name="OrgId">The caller's Org; scopes the Facility lookup (I-D03).</param>
/// <param name="FacilityId">The Facility to add the Permit to.</param>
/// <param name="ExpirationDate">The Permit's expiration date; must not be in the past (I-D17).</param>
/// <param name="Value">The permit number / identifier.</param>
public sealed record AddPermitCommand(Guid OrgId, Guid FacilityId, DateOnly ExpirationDate, string Value);

/// <summary>Handles <see cref="AddPermitCommand"/>.</summary>
public static class AddPermitHandler
{
    /// <summary>
    /// Adds a Permit to the caller's Facility. The Facility aggregate owns the rule that a Permit
    /// cannot already be expired (I-D17).
    /// </summary>
    /// <param name="command">The add command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The added Permit as a <see cref="PermitResponse"/>; a not-found error when the Facility is
    /// not in the caller's Org (I-D03); or a validation error when the Permit is already expired (I-D17).
    /// </returns>
    public static async Task<ErrorOr<PermitResponse>> Handle(
        AddPermitCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        var permit = Permit.Create(command.FacilityId, command.ExpirationDate, command.Value);
        var result = facility.AddPermit(permit);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.SaveChangesAsync(cancellationToken);
        return PermitResponse.FromPermit(permit);
    }
}
