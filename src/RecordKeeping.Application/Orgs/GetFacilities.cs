using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>Query for the Facilities owned by an Org.</summary>
/// <param name="OrgId">The Org whose Facilities to list.</param>
public sealed record GetFacilitiesQuery(Guid OrgId);

/// <summary>Handles <see cref="GetFacilitiesQuery"/>.</summary>
public static class GetFacilitiesHandler
{
    /// <summary>Returns the Org's Facilities as read models.</summary>
    /// <param name="query">The query carrying the Org id.</param>
    /// <param name="repository">The Org repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The Org's Facilities as <see cref="FacilityResponse"/> values (empty when it has none),
    /// or <see cref="OrgErrors.NotFound"/> when the Org does not exist.
    /// </returns>
    public static async Task<ErrorOr<IReadOnlyList<FacilityResponse>>> Handle(
        GetFacilitiesQuery query,
        IOrgRepository repository,
        CancellationToken cancellationToken)
    {
        var org = await repository.GetByIdAsync(query.OrgId, cancellationToken);
        if (org is null)
        {
            return OrgErrors.NotFound(query.OrgId);
        }

        IReadOnlyList<FacilityResponse> facilities =
            org.Facilities.Select(FacilityResponse.FromFacility).ToList();
        return facilities.ToErrorOr();
    }
}
