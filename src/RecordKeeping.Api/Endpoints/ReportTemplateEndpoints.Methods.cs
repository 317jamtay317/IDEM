using RecordKeeping.Application.Reporting;
using RecordKeeping.Application.ReportTemplates;

namespace RecordKeeping.Api.Endpoints;

public partial class ReportTemplateEndpoints
{
    /// <summary>Request body for saving a new Report Template.</summary>
    /// <param name="Name">The display name.</param>
    /// <param name="Rdl">The template definition as RDL/RDLC XML.</param>
    public sealed record CreateReportTemplateRequest(string Name, string Rdl);

    /// <summary>Request body for overwriting an existing Report Template.</summary>
    /// <param name="Name">The new display name.</param>
    /// <param name="Rdl">The new template definition as RDL/RDLC XML.</param>
    public sealed record UpdateReportTemplateRequest(string Name, string Rdl);

    /// <summary>Request body for the Report Template preview.</summary>
    /// <param name="Rdl">The Report Template's RDL/RDLC XML to render.</param>
    public sealed record PreviewReportTemplateRequest(string Rdl);

    private static async Task<IResult> GetReportTemplates(
        IReportTemplateRepository repository, CancellationToken cancellationToken)
    {
        var result = await GetReportTemplatesHandler.Handle(repository, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetReportTemplateById(
        Guid id, IReportTemplateRepository repository, CancellationToken cancellationToken)
    {
        var result = await GetReportTemplateByIdHandler.Handle(
            new GetReportTemplateByIdQuery(id), repository, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> CreateReportTemplate(
        CreateReportTemplateRequest request, IReportTemplateRepository repository, CancellationToken cancellationToken)
    {
        var result = await CreateReportTemplateHandler.Handle(
            new CreateReportTemplateCommand(request.Name, request.Rdl), repository, cancellationToken);
        return result.Match(template => Results.Created($"/api/report-templates/{template.Id}", template));
    }

    private static async Task<IResult> UpdateReportTemplate(
        Guid id, UpdateReportTemplateRequest request, IReportTemplateRepository repository, CancellationToken cancellationToken)
    {
        var result = await UpdateReportTemplateHandler.Handle(
            new UpdateReportTemplateCommand(id, request.Name, request.Rdl), repository, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> DeleteReportTemplate(
        Guid id, IReportTemplateRepository repository, CancellationToken cancellationToken)
    {
        var result = await DeleteReportTemplateHandler.Handle(
            new DeleteReportTemplateCommand(id), repository, cancellationToken);
        return result.Match(_ => Results.NoContent());
    }

    private static IResult PreviewReportTemplate(PreviewReportTemplateRequest request, IReportRenderer renderer)
    {
        var result = PreviewReportTemplateHandler.Handle(new PreviewReportTemplateQuery(request.Rdl), renderer);
        return result.Match(pdf => Results.File(pdf, "application/pdf"));
    }
}
