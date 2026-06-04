using ErrorOr;
using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Application.ProductionFields;

/// <summary>Command to add a new Production Field to the catalog.</summary>
/// <param name="PropertyName">The immutable machine key, e.g. <c>HotMix</c> (I-D21).</param>
/// <param name="FriendlyName">The human-facing label, e.g. "Hot Mix".</param>
/// <param name="DataType">The kind of value the field captures.</param>
/// <param name="Description">Optional help text.</param>
/// <param name="Category">Optional picker grouping.</param>
/// <param name="IsSummary">Whether the field appears in summaries/Reports by default.</param>
/// <param name="DisplayOrder">The field's sort position in the picker.</param>
public sealed record CreateProductionFieldCommand(
    string PropertyName,
    string FriendlyName,
    ProductionFieldDataType DataType,
    string? Description,
    string? Category,
    bool IsSummary,
    int DisplayOrder);

/// <summary>Handles <see cref="CreateProductionFieldCommand"/>.</summary>
public static class CreateProductionFieldHandler
{
    /// <summary>Validates, enforces catalog uniqueness, and persists a new Production Field.</summary>
    /// <param name="command">The create command.</param>
    /// <param name="repository">The Production Field repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The created field as a <see cref="ProductionFieldResponse"/>; a validation error when a value is
    /// invalid; <see cref="ProductionFieldErrors.DuplicatePropertyName"/> (I-D21) when the PropertyName is
    /// taken; or <see cref="ProductionFieldErrors.DuplicateFriendlyName"/> (I-D22) when an active field
    /// already uses the FriendlyName.
    /// </returns>
    public static async Task<ErrorOr<ProductionFieldResponse>> Handle(
        CreateProductionFieldCommand command,
        IProductionFieldRepository repository,
        CancellationToken cancellationToken)
    {
        var result = ProductionField.Create(
            command.PropertyName,
            command.FriendlyName,
            command.DataType,
            command.Description,
            command.Category,
            command.IsSummary,
            command.DisplayOrder);
        if (result.IsError)
        {
            return result.Errors;
        }

        var field = result.Value;

        // I-D21: PropertyName is the unique key across the whole catalog.
        if (await repository.GetByPropertyNameAsync(field.PropertyName, cancellationToken) is not null)
        {
            return ProductionFieldErrors.DuplicatePropertyName(field.PropertyName);
        }

        // I-D22: FriendlyName is unique among active fields.
        if (await repository.GetActiveByFriendlyNameAsync(field.FriendlyName, cancellationToken) is not null)
        {
            return ProductionFieldErrors.DuplicateFriendlyName(field.FriendlyName);
        }

        await repository.AddAsync(field, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return ProductionFieldResponse.FromProductionField(field);
    }
}
