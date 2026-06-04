namespace RecordKeeping.Application.ProductionFields;

/// <summary>Query for the Production Field catalog.</summary>
/// <param name="IncludeRetired">
/// When <see langword="true"/>, retired fields are included (the SiteAdmin view); when
/// <see langword="false"/>, only active fields are returned (the picker view).
/// </param>
public sealed record GetProductionFieldsQuery(bool IncludeRetired);

/// <summary>Handles <see cref="GetProductionFieldsQuery"/>.</summary>
public static class GetProductionFieldsHandler
{
    /// <summary>
    /// Returns the catalog as read models, ordered by <c>DisplayOrder</c> then <c>FriendlyName</c>.
    /// </summary>
    /// <param name="query">The query.</param>
    /// <param name="repository">The Production Field repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching fields as <see cref="ProductionFieldResponse"/> values.</returns>
    public static async Task<IReadOnlyList<ProductionFieldResponse>> Handle(
        GetProductionFieldsQuery query,
        IProductionFieldRepository repository,
        CancellationToken cancellationToken)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        return all
            .Where(field => query.IncludeRetired || field.IsActive)
            .OrderBy(field => field.DisplayOrder)
            .ThenBy(field => field.FriendlyName, StringComparer.OrdinalIgnoreCase)
            .Select(ProductionFieldResponse.FromProductionField)
            .ToList();
    }
}
