using ErrorOr;
using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Application.ProductionFields;

/// <summary>Command to update the editable attributes of an existing Production Field.</summary>
/// <param name="Id">The field to update.</param>
/// <param name="FriendlyName">The new human-facing label; required.</param>
/// <param name="DataType">The kind of value the field captures.</param>
/// <param name="Description">Optional help text.</param>
/// <param name="Category">Optional picker grouping.</param>
/// <param name="IsSummary">Whether the field appears in summaries/Reports by default.</param>
/// <param name="DisplayOrder">The field's sort position in the picker.</param>
public sealed record UpdateProductionFieldCommand(
    Guid Id,
    string FriendlyName,
    ProductionFieldDataType DataType,
    string? Description,
    string? Category,
    bool IsSummary,
    int DisplayOrder);

/// <summary>Handles <see cref="UpdateProductionFieldCommand"/>.</summary>
public static class UpdateProductionFieldHandler
{
    /// <summary>Applies the update, enforcing FriendlyName uniqueness; PropertyName is never touched.</summary>
    /// <param name="command">The update command.</param>
    /// <param name="repository">The Production Field repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The updated field; <see cref="ProductionFieldErrors.NotFound"/> when it does not exist;
    /// <see cref="ProductionFieldErrors.DuplicateFriendlyName"/> (I-D20) when the new label collides with
    /// another active field; or a validation error when the FriendlyName is invalid.
    /// </returns>
    public static async Task<ErrorOr<ProductionFieldResponse>> Handle(
        UpdateProductionFieldCommand command,
        IProductionFieldRepository repository,
        CancellationToken cancellationToken)
    {
        var field = await repository.GetByIdAsync(command.Id, cancellationToken);
        if (field is null)
        {
            return ProductionFieldErrors.NotFound(command.Id);
        }

        // I-D20: a rename must not collide with another active field's FriendlyName.
        var candidate = command.FriendlyName?.Trim() ?? string.Empty;
        var clash = await repository.GetActiveByFriendlyNameAsync(candidate, cancellationToken);
        if (clash is not null && clash.Id != field.Id)
        {
            return ProductionFieldErrors.DuplicateFriendlyName(candidate);
        }

        var update = field.Update(
            command.FriendlyName,
            command.DataType,
            command.Description,
            command.Category,
            command.IsSummary,
            command.DisplayOrder);
        if (update.IsError)
        {
            return update.Errors;
        }

        await repository.SaveChangesAsync(cancellationToken);
        return ProductionFieldResponse.FromProductionField(field);
    }
}
