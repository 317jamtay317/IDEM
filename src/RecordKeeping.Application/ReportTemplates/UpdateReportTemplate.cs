using ErrorOr;

namespace RecordKeeping.Application.ReportTemplates;

/// <summary>Command to overwrite an existing Report Template with the builder's latest definition.</summary>
/// <param name="Id">The template to update.</param>
/// <param name="Name">The new display name.</param>
/// <param name="Rdl">The new template definition as RDL/RDLC XML.</param>
public sealed record UpdateReportTemplateCommand(Guid Id, string Name, string Rdl);

/// <summary>Handles <see cref="UpdateReportTemplateCommand"/>.</summary>
public static class UpdateReportTemplateHandler
{
    /// <summary>Loads the template, applies the update, and persists it.</summary>
    /// <param name="command">The update command.</param>
    /// <param name="repository">The Report Template repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The updated template; <see cref="ReportTemplateErrors.NotFound"/> when it does not exist; or a
    /// validation error when a value is invalid.
    /// </returns>
    public static async Task<ErrorOr<ReportTemplateResponse>> Handle(
        UpdateReportTemplateCommand command,
        IReportTemplateRepository repository,
        CancellationToken cancellationToken)
    {
        var template = await repository.GetByIdAsync(command.Id, cancellationToken);
        if (template is null)
        {
            return ReportTemplateErrors.NotFound(command.Id);
        }

        var update = template.Update(command.Name, command.Rdl, DateTime.UtcNow);
        if (update.IsError)
        {
            return update.Errors;
        }

        await repository.SaveChangesAsync(cancellationToken);
        return ReportTemplateResponse.FromReportTemplate(template);
    }
}
