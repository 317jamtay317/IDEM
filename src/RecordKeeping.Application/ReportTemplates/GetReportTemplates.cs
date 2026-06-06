namespace RecordKeeping.Application.ReportTemplates;

/// <summary>Handles the query for the saved Report Template list.</summary>
public static class GetReportTemplatesHandler
{
    /// <summary>
    /// Returns every saved Report Template as a read model, most recently updated first (the order the
    /// Reports screen lists them in).
    /// </summary>
    /// <param name="repository">The Report Template repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The saved templates as <see cref="ReportTemplateResponse"/> values.</returns>
    public static async Task<IReadOnlyList<ReportTemplateResponse>> Handle(
        IReportTemplateRepository repository,
        CancellationToken cancellationToken)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        return all
            .OrderByDescending(template => template.UpdatedAtUtc)
            .Select(ReportTemplateResponse.FromReportTemplate)
            .ToList();
    }
}
