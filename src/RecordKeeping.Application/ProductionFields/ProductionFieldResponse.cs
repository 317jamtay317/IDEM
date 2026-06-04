using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Application.ProductionFields;

/// <summary>
/// Read model returned to API callers for a <see cref="ProductionField"/>.
/// </summary>
/// <param name="Id">The field's unique identifier.</param>
/// <param name="PropertyName">The immutable machine key (I-D19).</param>
/// <param name="FriendlyName">The human-facing label.</param>
/// <param name="Description">Optional help text, or <c>null</c>.</param>
/// <param name="DataType">The kind of value the field captures.</param>
/// <param name="Category">Optional picker grouping, or <c>null</c>.</param>
/// <param name="IsSummary">Whether the field appears in summaries/Reports by default.</param>
/// <param name="DisplayOrder">The field's sort position in the picker.</param>
/// <param name="IsActive">Whether the field is offered for new Records.</param>
public sealed record ProductionFieldResponse(
    Guid Id,
    string PropertyName,
    string FriendlyName,
    string? Description,
    ProductionFieldDataType DataType,
    string? Category,
    bool IsSummary,
    int DisplayOrder,
    bool IsActive)
{
    /// <summary>Projects a domain <see cref="ProductionField"/> into a <see cref="ProductionFieldResponse"/>.</summary>
    /// <param name="field">The field to project.</param>
    /// <returns>The response read model.</returns>
    public static ProductionFieldResponse FromProductionField(ProductionField field) => new(
        field.Id,
        field.PropertyName,
        field.FriendlyName,
        field.Description,
        field.DataType,
        field.Category,
        field.IsSummary,
        field.DisplayOrder,
        field.IsActive);
}
