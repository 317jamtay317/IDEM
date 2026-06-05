namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Endpoints for the SiteAdmin-only Report Builder (I-D13). v1 exposes a live PDF preview of a Report
/// Template's RDL rendered against sample data; template persistence and Org-scoped report runs are a
/// follow-up.
/// </summary>
public partial class ReportTemplateEndpoints : IEndpoint
{
    /// <inheritdoc />
    public void AddEndpoints(IEndpointRouteBuilder endpoints)
    {
        var reports = endpoints.MapGroup("api/report-templates")
            .WithTags("Report Templates")
            .RequireAuthorization("SiteAdmin");

        reports.MapPost("/preview", PreviewReportTemplate)
            .Produces(StatusCodes.Status200OK, contentType: "application/pdf")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithSummary("Renders a live PDF preview of a Report Template's RDL against sample data (SiteAdmin only).");
    }
}
