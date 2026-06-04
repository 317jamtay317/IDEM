using RecordKeeping.Domain.ProductionFieldLimits;

namespace RecordKeeping.Application.ProductionFieldLimits;

/// <summary>Read model returned to API callers for a <see cref="ProductionFieldLimit"/>.</summary>
/// <param name="PropertyName">The Production Field key the limit applies to (I-D21).</param>
/// <param name="LowLimit">The lowest acceptable recorded value.</param>
/// <param name="HighLimit">The highest acceptable recorded value.</param>
/// <param name="Unit">Whether the bounds are expressed as a percentage or in tons.</param>
public sealed record ProductionFieldLimitResponse(
    string PropertyName,
    decimal LowLimit,
    decimal HighLimit,
    LimitUnit Unit)
{
    /// <summary>Projects a domain <see cref="ProductionFieldLimit"/> into a <see cref="ProductionFieldLimitResponse"/>.</summary>
    /// <param name="limit">The limit to project.</param>
    /// <returns>The response read model.</returns>
    public static ProductionFieldLimitResponse FromLimit(ProductionFieldLimit limit) =>
        new(limit.PropertyName, limit.LowLimit, limit.HighLimit, limit.Unit);
}
