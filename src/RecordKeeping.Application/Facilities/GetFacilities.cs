using ErrorOr;
using RecordKeeping.Application.Orgs;

namespace RecordKeeping.Application.Facilities;

/// <summary>Query for the Facilities owned by an Org.</summary>
/// <param name="OrgId">The Org whose Facilities to list.</param>
public sealed record GetFacilitiesQuery(Guid OrgId);

/// <summary>Handles <see cref="GetFacilitiesQuery"/>.</summary>
public static class GetFacilitiesHandler
{
    /// <summary>Returns the Org's Facilities as read models, scoped to that Org (I-D03).</summary>
    /// <param name="query">The query carrying the Org id.</param>
    /// <param name="facilities">The Facility repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The Org's Facilities as <see cref="FacilityResponse"/> values; empty when it has none.</returns>
    public static async Task<ErrorOr<IReadOnlyList<FacilityResponse>>> Handle(
        GetFacilitiesQuery query,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var owned = await facilities.GetByOrgAsync(query.OrgId, cancellationToken);
        IReadOnlyList<FacilityResponse> responses =
            owned.Select(FacilityResponse.FromFacility).ToList();
        return responses.ToErrorOr();
    }
}
