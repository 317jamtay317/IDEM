namespace RecordKeeping.Domain.Common;

/// <summary>
/// Base type for entities — domain objects distinguished by a stable identity rather than by
/// their attribute values. Two entities of the same runtime type are equal when they share
/// the same <see cref="Id"/>, even if their other attributes differ.
/// </summary>
/// <typeparam name="TId">The type of the entity's identifier.</typeparam>
/// <param name="id">The entity's unique identifier.</param>
public abstract class Entity<TId>(TId id) : IEquatable<Entity<TId>>
    where TId : notnull
{
    /// <summary>The entity's unique identifier.</summary>
    public TId Id { get; } = id;

    /// <summary>
    /// Determines whether this entity is the same entity as <paramref name="other"/> —
    /// that is, the same runtime type with an equal <see cref="Id"/>.
    /// </summary>
    /// <param name="other">The entity to compare against.</param>
    /// <returns><c>true</c> when both are the same entity; otherwise <c>false</c>.</returns>
    public bool Equals(Entity<TId>? other)
    {
        if (other is null || other.GetType() != GetType())
        {
            return false;
        }

        return EqualityComparer<TId>.Default.Equals(Id, other.Id);
    }

    /// <inheritdoc />
    public override bool Equals(object? obj) => Equals(obj as Entity<TId>);

    /// <inheritdoc />
    public override int GetHashCode() => EqualityComparer<TId>.Default.GetHashCode(Id);

    /// <summary>Determines whether two entities are the same entity.</summary>
    /// <param name="left">The left operand.</param>
    /// <param name="right">The right operand.</param>
    /// <returns><c>true</c> when both are <c>null</c> or the same entity; otherwise <c>false</c>.</returns>
    public static bool operator ==(Entity<TId>? left, Entity<TId>? right) =>
        left is null ? right is null : left.Equals(right);

    /// <summary>Determines whether two entities are different entities.</summary>
    /// <param name="left">The left operand.</param>
    /// <param name="right">The right operand.</param>
    /// <returns><c>true</c> when the two are not the same entity; otherwise <c>false</c>.</returns>
    public static bool operator !=(Entity<TId>? left, Entity<TId>? right) => !(left == right);
}
