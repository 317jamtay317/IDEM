using ErrorOr;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFieldLimits;

namespace RecordKeeping.Application.ProductionFieldLimits;

/// <summary>Command to set (create or update) an Org's limit for a Production Field.</summary>
/// <param name="OrgId">The owning Org (taken from the caller's token, never client input) — I-D03.</param>
/// <param name="PropertyName">The Production Field the limit applies to (I-D21).</param>
/// <param name="LowLimit">The lowest acceptable recorded value.</param>
/// <param name="HighLimit">The highest acceptable recorded value; must be at least <paramref name="LowLimit"/> (I-D25).</param>
/// <param name="Unit">Whether the bounds are expressed as a percentage or in tons.</param>
public sealed record SetProductionFieldLimitCommand(
    Guid OrgId,
    string PropertyName,
    decimal LowLimit,
    decimal HighLimit,
    LimitUnit Unit);

/// <summary>Handles <see cref="SetProductionFieldLimitCommand"/>.</summary>
public static class SetProductionFieldLimitHandler
{
    /// <summary>
    /// Sets the Org's limit for a Production Field — creating it when none exists, or updating the
    /// existing one in place so an Org holds at most one limit per field (I-D24). The target must be a
    /// real Production Field; the limit is stored under the catalog's canonical PropertyName casing.
    /// </summary>
    /// <param name="command">The set command, carrying the Org (from the caller's token — I-D03), field, bounds and unit.</param>
    /// <param name="limits">The Production Field Limit repository.</param>
    /// <param name="fields">The Production Field catalog repository, used to confirm the target field exists.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The stored limit as a <see cref="ProductionFieldLimitResponse"/>;
    /// <see cref="ProductionFieldLimitErrors.FieldNotAvailable"/> when the field does not exist; or a
    /// validation error (I-D25) when the low bound exceeds the high bound.
    /// </returns>
    public static async Task<ErrorOr<ProductionFieldLimitResponse>> Handle(
        SetProductionFieldLimitCommand command,
        IProductionFieldLimitRepository limits,
        IProductionFieldRepository fields,
        CancellationToken cancellationToken)
    {
        // The catalog is the source of truth for which fields exist; a limit may only target a real one.
        var key = command.PropertyName?.Trim() ?? string.Empty;
        var field = await fields.GetByPropertyNameAsync(key, cancellationToken);
        if (field is null)
        {
            return ProductionFieldLimitErrors.FieldNotAvailable(key);
        }

        // I-D24: at most one limit per Org per Production Field — update the existing one, never add a second.
        var existing = await limits.GetByPropertyAsync(command.OrgId, field.PropertyName, cancellationToken);
        if (existing is not null)
        {
            var updateResult = existing.Update(command.LowLimit, command.HighLimit, command.Unit);
            if (updateResult.IsError)
            {
                return updateResult.Errors;
            }

            await limits.SaveChangesAsync(cancellationToken);
            return ProductionFieldLimitResponse.FromLimit(existing);
        }

        var createResult = ProductionFieldLimit.Create(
            command.OrgId, field.PropertyName, command.LowLimit, command.HighLimit, command.Unit);
        if (createResult.IsError)
        {
            return createResult.Errors;
        }

        await limits.AddAsync(createResult.Value, cancellationToken);
        await limits.SaveChangesAsync(cancellationToken);
        return ProductionFieldLimitResponse.FromLimit(createResult.Value);
    }
}
