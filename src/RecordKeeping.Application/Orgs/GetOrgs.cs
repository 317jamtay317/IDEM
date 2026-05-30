namespace RecordKeeping.Application.Orgs;

/// <summary>Query for all Orgs.</summary>
public sealed record GetOrgsQuery;

/// <summary>Handles <see cref="GetOrgsQuery"/>.</summary>
public static class GetOrgsHandler
{
    /// <summary>Returns every Org as a read model.</summary>
    /// <param name="query">The query.</param>
    /// <param name="repository">The Org repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>All Orgs as <see cref="OrgResponse"/> values.</returns>
    public static async Task<IReadOnlyList<OrgResponse>> Handle(
        GetOrgsQuery query,
        IOrgRepository repository,
        CancellationToken cancellationToken)
    {
        var orgs = await repository.GetAllAsync(cancellationToken);
        return orgs.Select(OrgResponse.FromOrg).ToList();
    }
}
