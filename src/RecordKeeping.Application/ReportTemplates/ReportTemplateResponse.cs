using RecordKeeping.Domain.ReportTemplates;

namespace RecordKeeping.Application.ReportTemplates;

/// <summary>
/// Read model returned to API callers for a <see cref="ReportTemplate"/>. Carries the full RDL so the
/// Report Builder can re-edit the template and the Report Engine can render it.
/// </summary>
/// <param name="Id">The template's unique identifier.</param>
/// <param name="Name">The display name.</param>
/// <param name="Rdl">The template definition as RDL/RDLC XML.</param>
/// <param name="CreatedAtUtc">When the template was first created (UTC).</param>
/// <param name="UpdatedAtUtc">When the template was last saved (UTC).</param>
public sealed record ReportTemplateResponse(
    Guid Id,
    string Name,
    string Rdl,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc)
{
    /// <summary>Projects a domain <see cref="ReportTemplate"/> into a <see cref="ReportTemplateResponse"/>.</summary>
    /// <param name="template">The template to project.</param>
    /// <returns>The response read model.</returns>
    public static ReportTemplateResponse FromReportTemplate(ReportTemplate template) => new(
        template.Id,
        template.Name,
        template.Rdl,
        template.CreatedAtUtc,
        template.UpdatedAtUtc);
}
