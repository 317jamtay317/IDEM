using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>
/// Business-outcome errors for Org operations, surfaced as <see cref="ErrorOr{T}"/>
/// results rather than exceptions.
/// </summary>
public static class OrgErrors
{
    /// <summary>No Org exists with the requested id.</summary>
    /// <param name="id">The id that was not found.</param>
    /// <returns>A not-found error.</returns>
    public static Error NotFound(Guid id) =>
        Error.NotFound("Org.NotFound", $"No Org exists with id '{id}'.");

    /// <summary>An Org cannot be renamed; its name is fixed at creation.</summary>
    public static Error NameImmutable { get; } =
        Error.Conflict("Org.Name.Immutable", "An Org cannot be renamed.");
}
