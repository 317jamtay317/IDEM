using ErrorOr;

namespace RecordKeeping.Application.ProductionFields;

/// <summary>Command to retire a Production Field so it is no longer offered for new Records.</summary>
/// <param name="Id">The field to retire.</param>
public sealed record RetireProductionFieldCommand(Guid Id);

/// <summary>Handles <see cref="RetireProductionFieldCommand"/>.</summary>
public static class RetireProductionFieldHandler
{
    /// <summary>Retires the field.</summary>
    /// <param name="command">The retire command.</param>
    /// <param name="repository">The Production Field repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The retired field, or <see cref="ProductionFieldErrors.NotFound"/> when it does not exist.</returns>
    public static async Task<ErrorOr<ProductionFieldResponse>> Handle(
        RetireProductionFieldCommand command,
        IProductionFieldRepository repository,
        CancellationToken cancellationToken)
    {
        var field = await repository.GetByIdAsync(command.Id, cancellationToken);
        if (field is null)
        {
            return ProductionFieldErrors.NotFound(command.Id);
        }

        field.Retire();
        await repository.SaveChangesAsync(cancellationToken);
        return ProductionFieldResponse.FromProductionField(field);
    }
}
