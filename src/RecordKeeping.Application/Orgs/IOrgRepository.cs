using RecordKeeping.Domain.Orgs;

namespace RecordKeeping.Application.Orgs;

/// <summary>
/// Persistence gateway for the <see cref="Org"/> aggregate. Implemented in the
/// Infrastructure layer; the Application layer depends only on this contract.
/// </summary>
public interface IOrgRepository
{
    /// <summary>Stages a newly created <paramref name="org"/> for insertion.</summary>
    /// <param name="org">The Org to add.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task AddAsync(Org org, CancellationToken cancellationToken);

    /// <summary>Loads the Org with the given <paramref name="id"/>, or <c>null</c> if none exists.</summary>
    /// <param name="id">The Org's unique identifier.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The tracked Org, or <c>null</c> when not found.</returns>
    Task<Org?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Loads every Org.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>All Orgs; empty when none exist.</returns>
    Task<IReadOnlyList<Org>> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>Stages <paramref name="org"/> for deletion.</summary>
    /// <param name="org">The Org to remove.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task RemoveAsync(Org org, CancellationToken cancellationToken);

    /// <summary>Persists all staged changes.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
