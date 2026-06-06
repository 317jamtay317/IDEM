using RecordKeeping.Domain.ReportTemplates;

namespace RecordKeeping.Application.ReportTemplates;

/// <summary>
/// Persistence gateway for the <see cref="ReportTemplate"/> aggregate. Implemented in the
/// Infrastructure layer; the Application layer depends only on this contract. Report Templates are
/// platform-global (not Org-scoped), so no method takes an Org id.
/// </summary>
public interface IReportTemplateRepository
{
    /// <summary>Stages a newly created <paramref name="template"/> for insertion.</summary>
    /// <param name="template">The Report Template to add.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task AddAsync(ReportTemplate template, CancellationToken cancellationToken);

    /// <summary>Loads the template with the given <paramref name="id"/>, or <c>null</c> if none exists.</summary>
    /// <param name="id">The template's unique identifier.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The tracked template, or <c>null</c> when not found.</returns>
    Task<ReportTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Loads every Report Template.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>All templates; empty when none exist.</returns>
    Task<IReadOnlyList<ReportTemplate>> GetAllAsync(CancellationToken cancellationToken);

    /// <summary>Stages the <paramref name="template"/> for deletion.</summary>
    /// <param name="template">The Report Template to remove.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task RemoveAsync(ReportTemplate template, CancellationToken cancellationToken);

    /// <summary>Persists all staged changes.</summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
