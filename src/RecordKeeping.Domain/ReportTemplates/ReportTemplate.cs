using ErrorOr;
using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.ReportTemplates;

/// <summary>
/// A Report Template — the layout-and-binding definition the Report Builder authors, stored as
/// RDL/RDLC so it can be listed, re-edited, and rendered to a Report by the Report Engine.
/// </summary>
/// <remarks>
/// Aggregate root, authored by SiteAdmins and shared across the whole platform — it is not
/// Org-scoped, so I-D03 does not apply to it (its content carries no Org data; an Org-scoped Report
/// <em>run</em> against it is a separate concern, see I-D11). Constructed only via <see cref="Create"/>.
/// <see cref="CreatedAtUtc"/> is assigned once and never changes; <see cref="UpdatedAtUtc"/> advances on
/// every <see cref="Update"/>.
/// </remarks>
public sealed class ReportTemplate : AggregateRoot<Guid>
{
    /// <summary>Maximum permitted length of a <see cref="Name"/>.</summary>
    public const int MaxNameLength = 200;

    /// <summary>The human-facing name shown in the saved-templates list, e.g. "Annual Emissions Inventory".</summary>
    public string Name { get; private set; }

    /// <summary>
    /// The template definition as RDL/RDLC XML, exactly as the Report Builder serializes it. Opaque to the
    /// domain; the Report Engine parses it to render a Report and the builder parses it to re-edit.
    /// </summary>
    public string Rdl { get; private set; }

    /// <summary>When the template was first created (UTC). Set once at creation; never changes.</summary>
    public DateTime CreatedAtUtc { get; }

    /// <summary>When the template was last saved (UTC). Equal to <see cref="CreatedAtUtc"/> until first edited.</summary>
    public DateTime UpdatedAtUtc { get; private set; }

    private ReportTemplate(Guid id, string name, string rdl, DateTime createdAtUtc, DateTime updatedAtUtc)
        : base(id)
    {
        Name = name;
        Rdl = rdl;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = updatedAtUtc;
    }

    /// <summary>
    /// Creates a new Report Template.
    /// </summary>
    /// <param name="name">The display name; required, trimmed, at most <see cref="MaxNameLength"/> characters.</param>
    /// <param name="rdl">The template definition as RDL/RDLC XML; required (non-empty).</param>
    /// <param name="nowUtc">The current UTC time, used for both timestamps.</param>
    /// <returns>The new Report Template, or a validation error when a value is invalid.</returns>
    public static ErrorOr<ReportTemplate> Create(string name, string rdl, DateTime nowUtc)
    {
        var validatedName = ValidateName(name);
        if (validatedName.IsError)
        {
            return validatedName.Errors;
        }

        var validatedRdl = ValidateRdl(rdl);
        if (validatedRdl.IsError)
        {
            return validatedRdl.Errors;
        }

        return new ReportTemplate(Guid.NewGuid(), validatedName.Value, validatedRdl.Value, nowUtc, nowUtc);
    }

    /// <summary>
    /// Replaces the template's name and definition, advancing <see cref="UpdatedAtUtc"/>.
    /// </summary>
    /// <param name="name">The new display name; required, trimmed, at most <see cref="MaxNameLength"/> characters.</param>
    /// <param name="rdl">The new template definition as RDL/RDLC XML; required (non-empty).</param>
    /// <param name="nowUtc">The current UTC time, recorded as the new <see cref="UpdatedAtUtc"/>.</param>
    /// <returns>Success, or a validation error when a value is invalid.</returns>
    public ErrorOr<Success> Update(string name, string rdl, DateTime nowUtc)
    {
        var validatedName = ValidateName(name);
        if (validatedName.IsError)
        {
            return validatedName.Errors;
        }

        var validatedRdl = ValidateRdl(rdl);
        if (validatedRdl.IsError)
        {
            return validatedRdl.Errors;
        }

        Name = validatedName.Value;
        Rdl = validatedRdl.Value;
        UpdatedAtUtc = nowUtc;
        return Result.Success;
    }

    private static ErrorOr<string> ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Error.Validation("ReportTemplate.Name.Required", "A Report Template name is required.");
        }

        var trimmed = name.Trim();
        if (trimmed.Length > MaxNameLength)
        {
            return Error.Validation(
                "ReportTemplate.Name.TooLong", $"A Report Template name cannot exceed {MaxNameLength} characters.");
        }

        return trimmed;
    }

    private static ErrorOr<string> ValidateRdl(string rdl)
    {
        if (string.IsNullOrWhiteSpace(rdl))
        {
            return Error.Validation("ReportTemplate.Rdl.Required", "A Report Template definition (RDL) is required.");
        }

        return rdl;
    }
}
