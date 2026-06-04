using ErrorOr;

namespace RecordKeeping.Application.ProductionFields;

/// <summary>Command to reactivate a retired Production Field so it is offered for new Records again.</summary>
/// <param name="Id">The field to reactivate.</param>
public sealed record ReactivateProductionFieldCommand(Guid Id);

/// <summary>Handles <see cref="ReactivateProductionFieldCommand"/>.</summary>
public static class ReactivateProductionFieldHandler
{
    /// <summary>Reactivates the field, provided doing so does not collide with an active field's label.</summary>
    /// <param name="command">The reactivate command.</param>
    /// <param name="repository">The Production Field repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The reactivated field; <see cref="ProductionFieldErrors.NotFound"/> when it does not exist; or
    /// <see cref="ProductionFieldErrors.DuplicateFriendlyName"/> (I-D20) when an active field already uses
    /// its FriendlyName.
    /// </returns>
    public static async Task<ErrorOr<ProductionFieldResponse>> Handle(
        ReactivateProductionFieldCommand command,
        IProductionFieldRepository repository,
        CancellationToken cancellationToken)
    {
        var field = await repository.GetByIdAsync(command.Id, cancellationToken);
        if (field is null)
        {
            return ProductionFieldErrors.NotFound(command.Id);
        }

        // I-D20: cannot reactivate into a clash with an already-active field's FriendlyName.
        var clash = await repository.GetActiveByFriendlyNameAsync(field.FriendlyName, cancellationToken);
        if (clash is not null && clash.Id != field.Id)
        {
            return ProductionFieldErrors.DuplicateFriendlyName(field.FriendlyName);
        }

        field.Reactivate();
        await repository.SaveChangesAsync(cancellationToken);
        return ProductionFieldResponse.FromProductionField(field);
    }
}
