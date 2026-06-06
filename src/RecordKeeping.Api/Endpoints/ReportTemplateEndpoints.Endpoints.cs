using RecordKeeping.Application.ReportTemplates;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Endpoints for the SiteAdmin-only Report Builder (I-D13): persistence (list, load, create, update) of
/// the Report Templates a SiteAdmin authors, plus a live PDF preview of a template's RDL rendered against
/// sample data. Org-scoped report runs are a follow-up. Templates are platform-global (not Org-scoped).
/// </summary>
public partial class ReportTemplateEndpoints : IEndpoint
{
    /// <inheritdoc />
    public void AddEndpoints(IEndpointRouteBuilder endpoints)
    {
        var reports = endpoints.MapGroup("api/report-templates")
            .WithTags("Report Templates")
            .RequireAuthorization("SiteAdmin");

        reports.MapGet("/", GetReportTemplates)
            .Produces<IReadOnlyList<ReportTemplateResponse>>()
            .WithSummary("Lists the saved Report Templates, most recently updated first (SiteAdmin only).");

        reports.MapGet("/{id:guid}", GetReportTemplateById)
            .Produces<ReportTemplateResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Loads a single Report Template, including its RDL, for editing (SiteAdmin only).");

        reports.MapPost("/", CreateReportTemplate)
            .Produces<ReportTemplateResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithSummary("Saves a new Report Template (SiteAdmin only).");

        reports.MapPut("/{id:guid}", UpdateReportTemplate)
            .Produces<ReportTemplateResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Overwrites a Report Template with the builder's latest definition (SiteAdmin only).");

        reports.MapDelete("/{id:guid}", DeleteReportTemplate)
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Deletes a saved Report Template (SiteAdmin only).");

        reports.MapPost("/preview", PreviewReportTemplate)
            .Produces(StatusCodes.Status200OK, contentType: "application/pdf")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithSummary("Renders a live PDF preview of a Report Template's RDL against sample data (SiteAdmin only).");
    }
}
