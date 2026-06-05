using ErrorOr;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to change the value of a Facility's Monthly Limit in the caller's Org.</summary>
/// <param name="OrgId">The caller's Org; scopes the Facility lookup (I-D03).</param>
/// <param name="FacilityId">The Facility whose limit to change.</param>
/// <param name="EmissionType">The Emission Type whose limit value to change.</param>
/// <param name="Value">The new cap, in tons per calendar month; must be positive (I-D20).</param>
public sealed record UpdateLimitCommand(Guid OrgId, Guid FacilityId, EmissionType EmissionType, double Value);

/// <summary>Handles <see cref="UpdateLimitCommand"/>.</summary>
public static class UpdateLimitHandler
{
    /// <summary>
    /// Changes the tons value of a Monthly Limit on the caller's Facility. The Facility aggregate
    /// owns the rules that the limit must exist and that its value is positive (I-D20).
    /// </summary>
    /// <param name="command">The update command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The updated limit as a <see cref="MonthlyLimitResponse"/>; a not-found error when the Facility
    /// is not in the caller's Org (I-D03) or the Facility holds no limit for the Emission Type; or a
    /// validation error when the new value is not positive (I-D20).
    /// </returns>
    public static async Task<ErrorOr<MonthlyLimitResponse>> Handle(
        UpdateLimitCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        var result = facility.UpdateLimit(command.EmissionType, command.Value);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.SaveChangesAsync(cancellationToken);
        var updated = facility.Limits.First(limit => limit.EmissionType == command.EmissionType);
        return MonthlyLimitResponse.FromLimit(updated);
    }
}
