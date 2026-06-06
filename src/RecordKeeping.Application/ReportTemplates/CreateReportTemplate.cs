using ErrorOr;
using RecordKeeping.Domain.ReportTemplates;

namespace RecordKeeping.Application.ReportTemplates;

/// <summary>Command to save a new Report Template authored in the Report Builder.</summary>
/// <param name="Name">The display name.</param>
/// <param name="Rdl">The template definition as RDL/RDLC XML.</param>
public sealed record CreateReportTemplateCommand(string Name, string Rdl);

/// <summary>Handles <see cref="CreateReportTemplateCommand"/>.</summary>
public static class CreateReportTemplateHandler
{
    /// <summary>Validates and persists a new Report Template.</summary>
    /// <param name="command">The create command.</param>
    /// <param name="repository">The Report Template repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The created template, or a validation error when a value is invalid.</returns>
    public static async Task<ErrorOr<ReportTemplateResponse>> Handle(
        CreateReportTemplateCommand command,
        IReportTemplateRepository repository,
        CancellationToken cancellationToken)
    {
        var result = ReportTemplate.Create(command.Name, command.Rdl, DateTime.UtcNow);
        if (result.IsError)
        {
            return result.Errors;
        }

        var template = result.Value;
        await repository.AddAsync(template, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return ReportTemplateResponse.FromReportTemplate(template);
    }
}
