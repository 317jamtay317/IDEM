using ErrorOr;

namespace RecordKeeping.Application.Reporting;

/// <summary>
/// Query to render a live preview of a Report Template's RDL against the server-side sample data.
/// Used by the SiteAdmin-only Report Builder, which has no Org context of its own.
/// </summary>
/// <param name="Rdl">The Report Template's RDL/RDLC XML, as produced by the builder.</param>
public sealed record PreviewReportTemplateQuery(string Rdl);

/// <summary>Handles <see cref="PreviewReportTemplateQuery"/>.</summary>
public static class PreviewReportTemplateHandler
{
    /// <summary>
    /// Renders the supplied template RDL to a PDF, bound to the sample data context.
    /// </summary>
    /// <param name="query">The preview query carrying the template RDL.</param>
    /// <param name="renderer">The report renderer.</param>
    /// <returns>
    /// The rendered PDF bytes; a validation error when the RDL is empty; or the renderer's error
    /// when the RDL cannot be parsed.
    /// </returns>
    public static ErrorOr<byte[]> Handle(PreviewReportTemplateQuery query, IReportRenderer renderer)
    {
        if (string.IsNullOrWhiteSpace(query.Rdl))
        {
            return Error.Validation(
                "Reporting.EmptyTemplate", "The report template (RDL) must not be empty.");
        }

        return renderer.RenderPdf(query.Rdl, SampleReportData.CreateContext());
    }
}
