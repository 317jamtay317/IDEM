using ErrorOr;

namespace RecordKeeping.Application.ProductionFieldLimits;

/// <summary>
/// Application-level business-outcome errors for Production Field Limit operations, surfaced as
/// <see cref="ErrorOr{T}"/> results rather than exceptions.
/// </summary>
public static class ProductionFieldLimitErrors
{
    /// <summary>
    /// The target of a limit is not a Production Field in the catalog, so a limit cannot be set for it.
    /// </summary>
    /// <param name="propertyName">The field key that does not exist in the catalog.</param>
    /// <returns>A validation error.</returns>
    public static Error FieldNotAvailable(string propertyName) =>
        Error.Validation(
            "ProductionFieldLimit.FieldNotAvailable",
            $"'{propertyName}' is not a Production Field and cannot have a limit.");
}
