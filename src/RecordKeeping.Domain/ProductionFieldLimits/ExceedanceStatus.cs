namespace RecordKeeping.Domain.ProductionFieldLimits;

/// <summary>
/// Where a recorded value falls relative to a <see cref="ProductionFieldLimit"/>'s acceptable range.
/// A value classified as <see cref="Below"/> or <see cref="Above"/> is an <em>Exceedance</em>.
/// </summary>
public enum ExceedanceStatus
{
    /// <summary>The value is within the inclusive range (an Exceedance is not raised).</summary>
    Within,

    /// <summary>The value is below the limit's low bound — an Exceedance.</summary>
    Below,

    /// <summary>The value is above the limit's high bound — an Exceedance.</summary>
    Above,
}
