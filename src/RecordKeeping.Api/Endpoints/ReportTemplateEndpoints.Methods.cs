using RecordKeeping.Application.Reporting;

namespace RecordKeeping.Api.Endpoints;

public partial class ReportTemplateEndpoints
{
    /// <summary>Request body for the Report Template preview.</summary>
    /// <param name="Rdl">The Report Template's RDL/RDLC XML to render.</param>
    public sealed record PreviewReportTemplateRequest(string Rdl);

    private static IResult PreviewReportTemplate(PreviewReportTemplateRequest request, IReportRenderer renderer)
    {
        var result = PreviewReportTemplateHandler.Handle(new PreviewReportTemplateQuery(request.Rdl), renderer);
        return result.Match(pdf => Results.File(pdf, "application/pdf"));
    }
}
