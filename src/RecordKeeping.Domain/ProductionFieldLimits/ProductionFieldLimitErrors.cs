using ErrorOr;

namespace RecordKeeping.Domain.ProductionFieldLimits;

/// <summary>
/// Domain errors the <see cref="ProductionFieldLimit"/> aggregate returns when an operation would
/// violate one of its invariants, surfaced as <see cref="ErrorOr{T}"/> results rather than exceptions.
/// </summary>
public static class ProductionFieldLimitErrors
{
    /// <summary>
    /// I-D25: a Production Field Limit's low bound may not exceed its high bound, so the acceptable
    /// range it defines is never empty.
    /// </summary>
    public static readonly Error LowExceedsHigh =
        Error.Validation("I-D25", "LowLimit cannot be greater than HighLimit.");
}
