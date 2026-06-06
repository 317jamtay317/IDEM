using ErrorOr;

namespace RecordKeeping.Application.ReportTemplates;

/// <summary>Command to delete a saved Report Template.</summary>
/// <param name="Id">The template to delete.</param>
public sealed record DeleteReportTemplateCommand(Guid Id);

/// <summary>Handles <see cref="DeleteReportTemplateCommand"/>.</summary>
public static class DeleteReportTemplateHandler
{
    /// <summary>Loads the template and removes it.</summary>
    /// <param name="command">The delete command.</param>
    /// <param name="repository">The Report Template repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// <see cref="Result.Deleted"/> on success, or <see cref="ReportTemplateErrors.NotFound"/> when no
    /// template has the given id.
    /// </returns>
    public static async Task<ErrorOr<Deleted>> Handle(
        DeleteReportTemplateCommand command,
        IReportTemplateRepository repository,
        CancellationToken cancellationToken)
    {
        var template = await repository.GetByIdAsync(command.Id, cancellationToken);
        if (template is null)
        {
            return ReportTemplateErrors.NotFound(command.Id);
        }

        await repository.RemoveAsync(template, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Deleted;
    }
}
