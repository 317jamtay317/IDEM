using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Application.ProductionFields;

/// <summary>
/// Persistence gateway for the <see cref="ProductionField"/> aggregate. Implemented in the
/// Infrastructure layer; the Application layer depends only on this contract. The catalog is
/// platform-global (not Org-scoped), so no method takes an Org id.
/// </summary>
public interface IProductionFieldRepository
{
    /// <summary>Stages a newly created <paramref name="field"/> for insertion.</summary>
    /// <param name="field">The Production Field to add.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task AddAsync(ProductionField field, CancellationToken cancellationToken);

    /// <summary>Loads the field with the given <paramref name="id"/>, or <c>null</c> if none exists.</summary>
    /// <param name="id">The field's unique identifier.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The tracked field, or <c>null</c> when not found.</returns>
    Task<ProductionField?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Loads the field with the given <paramref name="propertyName"/> (case-insensitive), or
    /// <c>null</c> if none exists. Used to enforce PropertyName uniqueness (I-D21).
    /// </summary>
    /// <param name="propertyName">The machine key to look up.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching field, or <c>null</c>.</returns>
    Task<ProductionField?> GetByPropertyNameAsync(string propertyName, CancellationToken cancellationToken);

    /// <summary>
    /// Loads the <em>active</em> field with the given <paramref name="friendlyName"/>
    /// (case-insensitive), or <c>null</c> if none exists. Used to enforce FriendlyName uniqueness
    /// among active fields (I-D22).
    /// </summary>
    /// <param name="friendlyName">The display label to look up.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching active field, or <c>null</c>.</returns>
    Task<ProductionField?> GetActiveByFriendlyNameAsync(string friendlyName, CancellationToken cancellationToken);

    /// <summary>Loads every Production Field in the catalog, active and retired.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>All fields; empty when none exist.</returns>
    Task<IReadOnlyList<ProductionField>> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>Persists all staged changes.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
