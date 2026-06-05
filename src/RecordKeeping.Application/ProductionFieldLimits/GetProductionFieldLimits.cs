using ErrorOr;

namespace RecordKeeping.Application.ProductionFieldLimits;

/// <summary>
/// Query for the Production Field Limits configured by an Org. Always Org-scoped so the result can
/// never include another Org's limits (I-D03).
/// </summary>
/// <param name="OrgId">The Org whose limits to list.</param>
public sealed record GetProductionFieldLimitsQuery(Guid OrgId);

/// <summary>Handles <see cref="GetProductionFieldLimitsQuery"/>.</summary>
public static class GetProductionFieldLimitsHandler
{
    /// <summary>
    /// Returns the Org's Production Field Limits as read models, scoped to that Org (I-D03).
    /// </summary>
    /// <param name="query">The query carrying the Org id.</param>
    /// <param name="limits">The Production Field Limit repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The Org's limits as <see cref="ProductionFieldLimitResponse"/> values; empty when none.</returns>
    public static async Task<ErrorOr<IReadOnlyList<ProductionFieldLimitResponse>>> Handle(
        GetProductionFieldLimitsQuery query,
        IProductionFieldLimitRepository limits,
        CancellationToken cancellationToken)
    {
        var found = await limits.GetByOrgAsync(query.OrgId, cancellationToken);
        IReadOnlyList<ProductionFieldLimitResponse> responses =
            found.Select(ProductionFieldLimitResponse.FromLimit).ToList();
        return responses.ToErrorOr();
    }
}
