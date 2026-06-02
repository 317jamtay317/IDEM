using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>Query for a single Org by id.</summary>
/// <param name="Id">The Org's unique identifier.</param>
public sealed record GetOrgByIdQuery(Guid Id);

/// <summary>Handles <see cref="GetOrgByIdQuery"/>.</summary>
public static class GetOrgByIdHandler
{
    /// <summary>Returns the requested Org with its Facilities, or a not-found error.</summary>
    /// <param name="query">The query carrying the Org id.</param>
    /// <param name="orgs">The Org repository.</param>
    /// <param name="facilities">The Facility repository, used to compose the response.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The Org as an <see cref="OrgResponse"/>, or <see cref="OrgErrors.NotFound"/>.</returns>
    public static async Task<ErrorOr<OrgResponse>> Handle(
        GetOrgByIdQuery query,
        IOrgRepository orgs,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var org = await orgs.GetByIdAsync(query.Id, cancellationToken);
        if (org is null)
        {
            return OrgErrors.NotFound(query.Id);
        }

        var owned = await facilities.GetByOrgAsync(org.Id, cancellationToken);
        return OrgResponse.FromOrg(org, owned);
    }
}
