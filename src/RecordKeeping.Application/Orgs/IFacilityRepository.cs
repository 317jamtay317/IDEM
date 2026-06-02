using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Orgs;

/// <summary>
/// Persistence gateway for the <see cref="Facility"/> aggregate. Implemented in the
/// Infrastructure layer; the Application layer depends only on this contract.
/// </summary>
/// <remarks>
/// Reads of a single Facility are scoped by <c>orgId</c> so a caller can never load a
/// Facility belonging to another Org (I-D03).
/// </remarks>
public interface IFacilityRepository
{
    /// <summary>Stages a newly created <paramref name="facility"/> for insertion.</summary>
    /// <param name="facility">The Facility to add.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task AddAsync(Facility facility, CancellationToken cancellationToken);

    /// <summary>
    /// Loads the Facility with the given <paramref name="facilityId"/> <b>only if</b> it belongs to
    /// <paramref name="orgId"/>; otherwise <c>null</c>. The Org scope enforces I-D03.
    /// </summary>
    /// <param name="orgId">The Org the Facility must belong to.</param>
    /// <param name="facilityId">The Facility's unique identifier.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The tracked Facility, or <c>null</c> when not found in that Org.</returns>
    Task<Facility?> GetByIdAsync(Guid orgId, Guid facilityId, CancellationToken cancellationToken);

    /// <summary>Loads every Facility owned by <paramref name="orgId"/>.</summary>
    /// <param name="orgId">The owning Org's id.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The Org's Facilities; empty when it has none.</returns>
    Task<IReadOnlyList<Facility>> GetByOrgAsync(Guid orgId, CancellationToken cancellationToken);

    /// <summary>
    /// Loads every Facility owned by any of the given <paramref name="orgIds"/>. Used to compose
    /// Org read models in cross-Org SiteAdmin queries; never exposed to Org Users.
    /// </summary>
    /// <param name="orgIds">The owning Org ids.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The matching Facilities; empty when there are none.</returns>
    Task<IReadOnlyList<Facility>> GetByOrgsAsync(
        IReadOnlyCollection<Guid> orgIds, CancellationToken cancellationToken);

    /// <summary>Stages <paramref name="facility"/> for deletion.</summary>
    /// <param name="facility">The Facility to remove.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task RemoveAsync(Facility facility, CancellationToken cancellationToken);

    /// <summary>Persists all staged changes.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
