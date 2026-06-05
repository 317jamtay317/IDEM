using ErrorOr;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>Command to add a Monthly Limit to a Facility in the caller's Org.</summary>
/// <param name="OrgId">The caller's Org; scopes the Facility lookup (I-D03).</param>
/// <param name="FacilityId">The Facility to add the limit to.</param>
/// <param name="EmissionType">The pollutant the limit constrains.</param>
/// <param name="Value">The cap, in tons per calendar month; must be positive (I-D20).</param>
public sealed record AddLimitCommand(Guid OrgId, Guid FacilityId, EmissionType EmissionType, double Value);

/// <summary>Handles <see cref="AddLimitCommand"/>.</summary>
public static class AddLimitHandler
{
    /// <summary>
    /// Adds a Monthly Limit to the caller's Facility. The Facility aggregate owns the rules that a
    /// limit is unique per Emission Type (I-D19) and that its value is positive (I-D20).
    /// </summary>
    /// <param name="command">The add command.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The added limit as a <see cref="MonthlyLimitResponse"/>; a not-found error when the Facility
    /// is not in the caller's Org (I-D03); or a validation error when a limit already exists for the
    /// Emission Type (I-D19) or the value is not positive (I-D20).
    /// </returns>
    public static async Task<ErrorOr<MonthlyLimitResponse>> Handle(
        AddLimitCommand command,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        var result = facility.AddLimit(command.EmissionType, command.Value);
        if (result.IsError)
        {
            return result.Errors;
        }

        await facilities.SaveChangesAsync(cancellationToken);
        var added = facility.Limits.First(limit => limit.EmissionType == command.EmissionType);
        return MonthlyLimitResponse.FromLimit(added);
    }
}
