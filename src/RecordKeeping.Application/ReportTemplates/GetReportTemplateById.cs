using ErrorOr;

namespace RecordKeeping.Application.ReportTemplates;

/// <summary>Query for a single Report Template by id (used to load it into the Report Builder for editing).</summary>
/// <param name="Id">The template to load.</param>
public sealed record GetReportTemplateByIdQuery(Guid Id);

/// <summary>Handles <see cref="GetReportTemplateByIdQuery"/>.</summary>
public static class GetReportTemplateByIdHandler
{
    /// <summary>Loads one Report Template, including its RDL.</summary>
    /// <param name="query">The query carrying the template id.</param>
    /// <param name="repository">The Report Template repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The template, or <see cref="ReportTemplateErrors.NotFound"/> when it does not exist.</returns>
    public static async Task<ErrorOr<ReportTemplateResponse>> Handle(
        GetReportTemplateByIdQuery query,
        IReportTemplateRepository repository,
        CancellationToken cancellationToken)
    {
        var template = await repository.GetByIdAsync(query.Id, cancellationToken);
        return template is null
            ? ReportTemplateErrors.NotFound(query.Id)
            : ReportTemplateResponse.FromReportTemplate(template);
    }
}
