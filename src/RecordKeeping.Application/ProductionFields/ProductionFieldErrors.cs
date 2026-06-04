using ErrorOr;

namespace RecordKeeping.Application.ProductionFields;

/// <summary>
/// Business-outcome errors for Production Field operations, surfaced as <see cref="ErrorOr{T}"/>
/// results rather than exceptions.
/// </summary>
public static class ProductionFieldErrors
{
    /// <summary>No Production Field exists with the requested id.</summary>
    /// <param name="id">The id that was not found.</param>
    /// <returns>A not-found error.</returns>
    public static Error NotFound(Guid id) =>
        Error.NotFound("ProductionField.NotFound", $"No Production Field exists with id '{id}'.");

    /// <summary>
    /// I-D19: another Production Field already uses the given <paramref name="propertyName"/>.
    /// </summary>
    /// <param name="propertyName">The conflicting machine key.</param>
    /// <returns>A conflict error.</returns>
    public static Error DuplicatePropertyName(string propertyName) =>
        Error.Conflict("I-D19", $"A Production Field with PropertyName '{propertyName}' already exists.");

    /// <summary>
    /// I-D20: another active Production Field already uses the given <paramref name="friendlyName"/>.
    /// </summary>
    /// <param name="friendlyName">The conflicting display label.</param>
    /// <returns>A conflict error.</returns>
    public static Error DuplicateFriendlyName(string friendlyName) =>
        Error.Conflict("I-D20", $"An active Production Field with FriendlyName '{friendlyName}' already exists.");
}
