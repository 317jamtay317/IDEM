namespace RecordKeeping.Domain.ProductionFieldLimits;

/// <summary>
/// How a <see cref="ProductionFieldLimit"/>'s bounds are expressed — either a percentage or an
/// absolute quantity in tons. (🟡 tentative — pending domain-owner confirmation of the unit set.)
/// </summary>
public enum LimitUnit
{
    /// <summary>The bounds are a percentage (e.g. % sulfur in fuel).</summary>
    Percentage,

    /// <summary>The bounds are an absolute quantity, in tons.</summary>
    Tons,
}
