using ErrorOr;
using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.ProductionFieldLimits;

/// <summary>
/// An Org's configured acceptable range for the values recorded against a single Production Field
/// (keyed by its immutable <c>PropertyName</c>). A recorded value below <see cref="LowLimit"/> or
/// above <see cref="HighLimit"/> is an exceedance.
/// </summary>
/// <remarks>
/// Aggregate root, constructed only via <see cref="Create"/>. An Org holds at most one Production
/// Field Limit per Production Field (I-D24, enforced at the application/persistence layer since it
/// spans the catalog). The aggregate owns the rule that the low bound may not exceed the high bound
/// (I-D25). Its <see cref="OrgId"/> and <see cref="PropertyName"/> are assigned at creation and never
/// change; the bounds and <see cref="Unit"/> are editable via <see cref="Update"/>. Org-scoped:
/// a Facility's recorded values are checked only against the limits of the Org that owns it (I-D03).
/// </remarks>
public sealed class ProductionFieldLimit : AggregateRoot<Guid>
{
    /// <summary>The Org that owns this limit. Required and immutable (I-D03 scoping).</summary>
    public Guid OrgId { get; }

    /// <summary>
    /// The Production Field key the limit applies to (e.g. <c>PercentSulfurNumber2</c>). Matches the
    /// catalog's immutable <c>PropertyName</c> (I-D21); assigned once and never changes.
    /// </summary>
    public string PropertyName { get; }

    /// <summary>The lowest acceptable recorded value; a recorded value below it is an exceedance.</summary>
    public decimal LowLimit { get; private set; }

    /// <summary>The highest acceptable recorded value; a recorded value above it is an exceedance.</summary>
    public decimal HighLimit { get; private set; }

    /// <summary>Whether the bounds are expressed as a percentage or in tons.</summary>
    public LimitUnit Unit { get; private set; }

    private ProductionFieldLimit(
        Guid id, Guid orgId, string propertyName, decimal lowLimit, decimal highLimit, LimitUnit unit)
        : base(id)
    {
        OrgId = orgId;
        PropertyName = propertyName;
        LowLimit = lowLimit;
        HighLimit = highLimit;
        Unit = unit;
    }

    /// <summary>
    /// Creates a Production Field Limit for an Org and Production Field.
    /// </summary>
    /// <param name="orgId">The owning Org's id; required and immutable thereafter.</param>
    /// <param name="propertyName">The Production Field key the limit applies to; required, trimmed.</param>
    /// <param name="lowLimit">The lowest acceptable recorded value.</param>
    /// <param name="highLimit">The highest acceptable recorded value; must be at least <paramref name="lowLimit"/>.</param>
    /// <param name="unit">Whether the bounds are expressed as a percentage or in tons.</param>
    /// <returns>The new limit, or a validation error when a value is invalid.</returns>
    public static ErrorOr<ProductionFieldLimit> Create(
        Guid orgId, string propertyName, decimal lowLimit, decimal highLimit, LimitUnit unit)
    {
        if (orgId == Guid.Empty)
        {
            return Error.Validation(
                "ProductionFieldLimit.OrgId.Empty", "OrgId is required for a Production Field Limit.");
        }

        if (string.IsNullOrWhiteSpace(propertyName))
        {
            return Error.Validation(
                "ProductionFieldLimit.PropertyName.Empty",
                "PropertyName is required for a Production Field Limit.");
        }

        if (lowLimit > highLimit)
        {
            // I-D25: a limit's low bound may not exceed its high bound.
            return ProductionFieldLimitErrors.LowExceedsHigh;
        }

        return new ProductionFieldLimit(
            Guid.NewGuid(), orgId, propertyName.Trim(), lowLimit, highLimit, unit);
    }

    /// <summary>
    /// Updates the editable bounds and unit of the limit. The immutable <see cref="OrgId"/> and
    /// <see cref="PropertyName"/> are never touched.
    /// </summary>
    /// <param name="lowLimit">The new lowest acceptable recorded value.</param>
    /// <param name="highLimit">The new highest acceptable recorded value; must be at least <paramref name="lowLimit"/>.</param>
    /// <param name="unit">Whether the bounds are expressed as a percentage or in tons.</param>
    /// <returns>
    /// Success, or <see cref="ProductionFieldLimitErrors.LowExceedsHigh"/> (I-D25) when the low bound
    /// exceeds the high bound; on error the limit is left unchanged.
    /// </returns>
    public ErrorOr<Success> Update(decimal lowLimit, decimal highLimit, LimitUnit unit)
    {
        if (lowLimit > highLimit)
        {
            // I-D25: a limit's low bound may not exceed its high bound.
            return ProductionFieldLimitErrors.LowExceedsHigh;
        }

        LowLimit = lowLimit;
        HighLimit = highLimit;
        Unit = unit;
        return Result.Success;
    }
}
