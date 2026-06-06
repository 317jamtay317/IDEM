using ErrorOr;

namespace RecordKeeping.Application.ReportTemplates;

/// <summary>
/// Business-outcome errors for Report Template operations, surfaced as <see cref="ErrorOr{T}"/> results
/// rather than exceptions.
/// </summary>
public static class ReportTemplateErrors
{
    /// <summary>No Report Template exists with the requested id.</summary>
    /// <param name="id">The id that was not found.</param>
    /// <returns>A not-found error.</returns>
    public static Error NotFound(Guid id) =>
        Error.NotFound("ReportTemplate.NotFound", $"No Report Template exists with id '{id}'.");
}
