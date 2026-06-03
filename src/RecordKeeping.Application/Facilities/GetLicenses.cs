using ErrorOr;

namespace RecordKeeping.Application.Facilities;

/// <summary>Query for the licenses held by a Facility in the caller's Org.</summary>
/// <param name="OrgId">The caller's Org; scopes the Facility lookup (I-D03).</param>
/// <param name="FacilityId">The Facility whose licenses to list.</param>
public sealed record GetLicensesQuery(Guid OrgId, Guid FacilityId);

/// <summary>Handles <see cref="GetLicensesQuery"/>.</summary>
public static class GetLicensesHandler
{
    /// <summary>Returns the Facility's licenses, scoped to the caller's Org (I-D03).</summary>
    /// <param name="query">The query carrying the Org and Facility ids.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The Facility's licenses as <see cref="LicenseResponse"/> values; a not-found error when the
    /// Facility is not in the caller's Org (I-D03).
    /// </returns>
    public static async Task<ErrorOr<IReadOnlyList<LicenseResponse>>> Handle(
        GetLicensesQuery query,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var facility = await facilities.GetByIdAsync(query.OrgId, query.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(query.FacilityId);
        }

        IReadOnlyList<LicenseResponse> responses =
            facility.Licenses.Select(LicenseResponse.FromLicense).ToList();
        return responses.ToErrorOr();
    }
}
