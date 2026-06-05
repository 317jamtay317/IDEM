using RecordKeeping.Domain.ProductionFieldLimits;

namespace RecordKeeping.Application.ProductionFieldLimits;

/// <summary>
/// Persistence gateway for the <see cref="ProductionFieldLimit"/> aggregate. Implemented in the
/// Infrastructure layer; the Application layer depends only on this contract.
/// </summary>
/// <remarks>
/// Reads are scoped by <c>orgId</c> so a caller can never load another Org's limits (I-D03).
/// </remarks>
public interface IProductionFieldLimitRepository
{
    /// <summary>Stages a newly created <paramref name="limit"/> for insertion.</summary>
    /// <param name="limit">The limit to add.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task AddAsync(ProductionFieldLimit limit, CancellationToken cancellationToken);

    /// <summary>
    /// Loads the Org's limit for <paramref name="propertyName"/> (case-insensitive), or <c>null</c> if
    /// none exists. The Org scope enforces I-D03; used to keep at most one limit per field (I-D24).
    /// </summary>
    /// <param name="orgId">The Org the limit must belong to.</param>
    /// <param name="propertyName">The Production Field key the limit applies to.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching limit, or <c>null</c>.</returns>
    Task<ProductionFieldLimit?> GetByPropertyAsync(
        Guid orgId, string propertyName, CancellationToken cancellationToken);

    /// <summary>
    /// Loads every Production Field Limit owned by <paramref name="orgId"/>. The Org filter is applied
    /// at the query level so a caller can never read another Org's limits (I-D03).
    /// </summary>
    /// <param name="orgId">The owning Org's id; always applied.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The Org's limits; empty when none exist.</returns>
    Task<IReadOnlyList<ProductionFieldLimit>> GetByOrgAsync(Guid orgId, CancellationToken cancellationToken);

    /// <summary>Persists all staged changes.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
