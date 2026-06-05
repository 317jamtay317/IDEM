using ErrorOr;

namespace RecordKeeping.Domain.Records;

/// <summary>
/// Domain-level business-outcome errors for the <see cref="Record"/> aggregate, surfaced as
/// <see cref="ErrorOr{T}"/> results rather than exceptions.
/// </summary>
public static class RecordErrors
{
    /// <summary>
    /// The Record already holds a value for the given <paramref name="propertyName"/>; a field may
    /// be recorded at most once per Record.
    /// </summary>
    /// <param name="propertyName">The field key that is already present on the Record.</param>
    /// <returns>A conflict error.</returns>
    public static Error DuplicateValue(string propertyName) =>
        Error.Conflict(
            "Record.Value.Duplicate", $"This Record already has a value for field '{propertyName}'.");
}
