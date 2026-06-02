namespace RecordKeeping.Domain.Common;

/// <summary>
/// Base type for value objects — domain concepts that are defined by the equality of
/// their constituent attributes rather than by a persistent identity. Value objects are
/// immutable; a change produces a new instance.
/// </summary>
/// <remarks>
/// Equality is structural: two value objects of the same runtime type are equal when the
/// components returned by <see cref="GetEqualityComponents"/> are pairwise equal, in order.
/// Derive from this type and yield those components to get value semantics for free.
/// </remarks>
public abstract class ValueObject : IEquatable<ValueObject>
{
    /// <summary>
    /// Returns the components that define this value object's value, in a stable order.
    /// Two instances of the same type are equal when their components are pairwise equal.
    /// </summary>
    /// <returns>The ordered equality components.</returns>
    protected abstract IEnumerable<object?> GetEqualityComponents();

    /// <summary>
    /// Determines whether this value object is equal to <paramref name="other"/> by comparing
    /// their equality components. Instances of different runtime types are never equal.
    /// </summary>
    /// <param name="other">The value object to compare against.</param>
    /// <returns><c>true</c> when the two are component-wise equal; otherwise <c>false</c>.</returns>
    public bool Equals(ValueObject? other)
    {
        if (other is null || other.GetType() != GetType())
        {
            return false;
        }

        return GetEqualityComponents().SequenceEqual(other.GetEqualityComponents());
    }

    /// <inheritdoc />
    public override bool Equals(object? obj) => Equals(obj as ValueObject);

    /// <inheritdoc />
    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var component in GetEqualityComponents())
        {
            hash.Add(component);
        }

        return hash.ToHashCode();
    }

    /// <summary>Determines whether two value objects are equal.</summary>
    /// <param name="left">The left operand.</param>
    /// <param name="right">The right operand.</param>
    /// <returns><c>true</c> when both are <c>null</c> or component-wise equal; otherwise <c>false</c>.</returns>
    public static bool operator ==(ValueObject? left, ValueObject? right) =>
        left is null ? right is null : left.Equals(right);

    /// <summary>Determines whether two value objects are not equal.</summary>
    /// <param name="left">The left operand.</param>
    /// <param name="right">The right operand.</param>
    /// <returns><c>true</c> when the two are not equal; otherwise <c>false</c>.</returns>
    public static bool operator !=(ValueObject? left, ValueObject? right) => !(left == right);
}
