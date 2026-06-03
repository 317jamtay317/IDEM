using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Orgs;

/// <summary>Query for all Orgs.</summary>
public sealed record GetOrgsQuery;

/// <summary>Handles <see cref="GetOrgsQuery"/>.</summary>
public static class GetOrgsHandler
{
    /// <summary>Returns every Org as a read model, each with its Facilities.</summary>
    /// <param name="query">The query.</param>
    /// <param name="orgs">The Org repository.</param>
    /// <param name="facilities">The Facility repository, used to compose each response.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>All Orgs as <see cref="OrgResponse"/> values.</returns>
    public static async Task<IReadOnlyList<OrgResponse>> Handle(
        GetOrgsQuery query,
        IOrgRepository orgs,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var allOrgs = await orgs.GetAllAsync(cancellationToken);
        var orgIds = allOrgs.Select(o => o.Id).ToList();

        var allFacilities = await facilities.GetByOrgsAsync(orgIds, cancellationToken);
        var facilitiesByOrg = allFacilities
            .GroupBy(f => f.OrgId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Facility>)g.ToList());

        return allOrgs
            .Select(o => OrgResponse.FromOrg(o, facilitiesByOrg.GetValueOrDefault(o.Id, [])))
            .ToList();
    }
}
